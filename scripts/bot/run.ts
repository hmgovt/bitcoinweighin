/**
 * run.ts — X bot orchestrator (one post per invocation).
 *
 * Flow: pick the slot due now (by UTC hour, or --slot) → guard against
 * dedup + budget → compute content (absolute "1 BTC = cube" or day-delta
 * reframe) → render the share card → post → record state.
 *
 *   npx tsx scripts/bot/run.ts --slot=gold-am --dry-run   # compose+render, post nothing
 *   npx tsx scripts/bot/run.ts --slot=gold-am             # live
 *   npx tsx scripts/bot/run.ts                            # auto-pick slot by current UTC hour
 *
 * State lives in data/bot-state.json and is committed back by the workflow.
 * Card images go to output/cards/ (gitignored).
 */
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCard } from './make-card.ts';
import { postTweet } from './post.ts';
import { computeDelta } from './deltas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = join(__dirname, 'config.json');
const OBJECTS_PATH = join(__dirname, 'objects.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');
const STATE_PATH = join(PROJECT_ROOT, 'data', 'bot-state.json');
const CARD_OUT = join(PROJECT_ROOT, 'output', 'cards');

type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238';
interface Slot {
	id: string;
	utcHour: number;
	commodity: CommodityId;
	format: 'absolute' | 'delta';
	btc: number;
}
interface Config {
	siteBase: string;
	handle: string;
	budget: { balanceCents: number; centsPerPost: number; monthlyCap: number };
	physical: Record<CommodityId, { display: string; noun: string; shape: 'cube' | 'mass'; densityGPerCm3?: number; novelty?: boolean }>;
	slots: Slot[];
	slotCatchupHours: number;
}
interface State {
	monthKey: string;
	postsThisMonth: number;
	creditsSpentCents: number;
	lastSlotDate: Record<string, string>;
	posts: Array<{ at: string; slot: string; commodity: string; tweetId: string; caption: string }>;
}
type DayPrices = { btc: number; [field: string]: number };
type PriceData = Record<string, DayPrices>;

const TROY_OZ_G = 31.1035;
const LB_PER_KG = 2.20462;

function arg(name: string): string | undefined {
	return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}
const has = (flag: string) => process.argv.includes(flag);

async function readJson<T>(p: string): Promise<T> {
	return JSON.parse(await fs.readFile(p, 'utf-8')) as T;
}

function monthKeyOf(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** grams of `commodity` that 1 BTC buys at a day's prices (mirrors deltas.ts). */
function gramsPerBtc(commodity: CommodityId, day: DayPrices, objs: any): number {
	const rule = objs.pricing[commodity];
	if (rule.kind === 'fixed') return day.btc / rule.usdPerGram;
	const usdPerGram = rule.perTroyOz ? day[rule.field] / TROY_OZ_G : day[rule.field];
	return day.btc / usdPerGram;
}

function fmtWeight(grams: number): string {
	const kg = grams / 1000;
	const lb = kg * LB_PER_KG;
	if (grams < 1000) return `${grams.toFixed(0)} g (${lb.toFixed(2)} lb)`;
	return `${kg.toFixed(1)} kg (${lb.toFixed(1)} lb)`;
}

/** Cube edge in mm/cm for a mass at a given density. */
function cubeEdge(grams: number, density: number): { mm: number; cm: number } {
	const volCm3 = grams / density;
	const cm = Math.cbrt(volCm3);
	return { mm: cm * 10, cm };
}

interface Content {
	caption: string;
	btc: number;
	commodity: CommodityId;
}

function buildAbsolute(slot: Slot, cfg: Config, objs: any, day: DayPrices): Content {
	const phys = cfg.physical[slot.commodity];
	const grams = gramsPerBtc(slot.commodity, day, objs) * slot.btc;
	const weight = fmtWeight(grams);

	let caption: string;
	if (phys.shape === 'cube' && phys.densityGPerCm3) {
		const { mm } = cubeEdge(grams, phys.densityGPerCm3);
		const edge = mm < 100 ? `${mm.toFixed(0)} mm` : `${(mm / 10).toFixed(1)} cm`;
		if (phys.novelty) {
			caption = `1 BTC today = a ${edge} cube of ${phys.noun} — the glowing isotope that powers deep-space probes. Weighs ${weight}.`;
		} else {
			const palm = mm < 80 ? ' Fits in your palm.' : '';
			caption = `1 BTC today = a ${edge} ${phys.noun} cube.${palm} Weighs ${weight}.`;
		}
	} else {
		// mass-only (cocaine): no cube
		caption = `1 BTC today = ${weight} of ${phys.noun}, at wholesale.`;
	}
	return { caption, btc: slot.btc, commodity: slot.commodity };
}

function buildDelta(slot: Slot, cfg: Config, objs: any, prices: PriceData, dates: string[]): Content {
	const [pd, cd] = [dates[dates.length - 2], dates[dates.length - 1]];
	const r = computeDelta(objs, slot.commodity, { date: pd, day: prices[pd] }, { date: cd, day: prices[cd] });
	return { caption: r.caption, btc: slot.btc, commodity: slot.commodity };
}

/**
 * Catch-up slot selection. GitHub frequently delays scheduled runs by
 * 1–4h, so matching "current hour == slot hour" silently drops late runs.
 * Instead, pick the earliest slot scheduled *today* (UTC) whose time has
 * passed, hasn't posted today, and is no more than `slotCatchupHours` old.
 * A delayed run still fires the right slot; a missed slot is recovered by
 * the next run within the window. Earliest-first so backlogs drain in order.
 */
export function pickSlot(cfg: Config, now: Date, state: State, today: string): Slot | null {
	const explicit = arg('slot');
	if (explicit) {
		const s = cfg.slots.find((x) => x.id === explicit);
		if (!s) throw new Error(`Unknown --slot "${explicit}". Options: ${cfg.slots.map((x) => x.id).join(', ')}`);
		return s;
	}
	const lookbackMs = cfg.slotCatchupHours * 3_600_000;
	let best: { slot: Slot; sched: number } | null = null;
	for (const s of cfg.slots) {
		if (state.lastSlotDate[s.id] === today) continue; // already posted today
		const sched = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), s.utcHour, 0, 0);
		const age = now.getTime() - sched;
		if (age < 0 || age > lookbackMs) continue; // not due yet, or too stale
		if (!best || sched < best.sched) best = { slot: s, sched };
	}
	return best?.slot ?? null;
}

async function main() {
	const dryRun = has('--dry-run');
	const force = has('--force'); // bypass dedup (still respects budget)
	const now = new Date();

	const [cfg, objs, prices, state] = await Promise.all([
		readJson<Config>(CONFIG_PATH),
		readJson<any>(OBJECTS_PATH),
		readJson<PriceData>(PRICES_PATH),
		readJson<State>(STATE_PATH),
	]);

	// roll month counter
	const mk = monthKeyOf(now);
	if (state.monthKey !== mk) {
		state.monthKey = mk;
		state.postsThisMonth = 0;
	}

	const today = isoDate(now);
	const slot = pickSlot(cfg, now, state, today);
	if (!slot) {
		console.log(`No slot due at UTC hour ${now.getUTCHours()}. Slots: ${cfg.slots.map((s) => `${s.id}@${s.utcHour}`).join(', ')}.`);
		return;
	}

	console.log(`Slot: ${slot.id} (${slot.commodity}/${slot.format})  mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

	// ── Guards ──────────────────────────────────────────────────────
	if (!force && state.lastSlotDate[slot.id] === today) {
		console.log(`✓ Already posted ${slot.id} today (${today}). Skipping.`);
		return;
	}
	if (state.postsThisMonth >= cfg.budget.monthlyCap) {
		console.log(`✗ Monthly cap reached (${state.postsThisMonth}/${cfg.budget.monthlyCap}). Skipping.`);
		return;
	}
	const remainingCents = cfg.budget.balanceCents - state.creditsSpentCents;
	if (remainingCents < cfg.budget.centsPerPost) {
		console.log(`✗ Credit guard: ${remainingCents}c left < ${cfg.budget.centsPerPost}c/post. Top up at X. Skipping.`);
		return;
	}

	// ── Content ─────────────────────────────────────────────────────
	const dates = Object.keys(prices).sort();
	const latest = prices[dates[dates.length - 1]];
	const content =
		slot.format === 'delta'
			? buildDelta(slot, cfg, objs, prices, dates)
			: buildAbsolute(slot, cfg, objs, latest);

	console.log('─'.repeat(60));
	console.log(content.caption);
	console.log('─'.repeat(60));
	console.log(`caption length: ${content.caption.length}/280`);

	// ── Render card ─────────────────────────────────────────────────
	const out = join(CARD_OUT, `${slot.id}-${today}.png`);
	console.log(`Rendering card → ${out}`);
	const imagePath = await renderCard({
		btc: content.btc,
		commodity: content.commodity,
		date: dates[dates.length - 1],
		out,
	});
	console.log(`  ✓ ${imagePath}`);

	if (dryRun) {
		console.log('✓ Dry run complete — nothing posted, state unchanged.');
		return;
	}

	// ── Post ────────────────────────────────────────────────────────
	const tweetId = await postTweet(imagePath, content.caption);
	console.log(`✓ Posted: https://x.com/${cfg.handle}/status/${tweetId}`);

	// ── Record state ────────────────────────────────────────────────
	state.lastSlotDate[slot.id] = today;
	state.postsThisMonth += 1;
	state.creditsSpentCents += cfg.budget.centsPerPost;
	state.posts.push({ at: now.toISOString(), slot: slot.id, commodity: slot.commodity, tweetId, caption: content.caption });
	if (state.posts.length > 200) state.posts = state.posts.slice(-200);
	await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
	console.log(`State updated: ${state.postsThisMonth}/${cfg.budget.monthlyCap} this month, ${cfg.budget.balanceCents - state.creditsSpentCents}c left.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error('✗ run failed:', err?.message || err);
		process.exit(1);
	});
}
