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
import { renderCard, renderHashweightCard } from './make-card.ts';
import { postTweet } from './post.ts';
import { computeDelta, gramsPerBtc, type DeltaObjectsFile } from '../../src/lib/deltas.ts';
import { fetchHashrateEH, computeNetworkWeight } from '../../src/lib/network-weight.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = join(__dirname, 'config.json');
const OBJECTS_PATH = join(PROJECT_ROOT, 'src', 'lib', 'delta-objects.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');
const STATE_PATH = join(PROJECT_ROOT, 'data', 'bot-state.json');
const CARD_OUT = join(PROJECT_ROOT, 'output', 'cards');

type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238';
interface Slot {
	id: string;
	commodity: CommodityId | 'hashweight';
	format: 'absolute' | 'delta' | 'hashweight';
	btc: number;
}
interface Config {
	siteBase: string;
	handle: string;
	budget: { balanceCents: number; centsPerPostNoLink: number; centsPerPostWithLink: number; linkThresholdPct: number; monthlyCap: number };
	physical: Record<CommodityId, { display: string; noun: string; shape: 'cube' | 'mass'; densityGPerCm3?: number; novelty?: boolean }>;
	slots: Slot[];
	rotation: (string | null)[];
	dailyUtcHour: number;
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

const LB_PER_KG = 2.20462;
const HASHRATE_FALLBACK_EH = 800; // mirrors NetworkWeightPanel's offline fallback

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
	commodity: CommodityId | 'hashweight';
}

function buildAbsolute(slot: Slot, cfg: Config, objs: DeltaObjectsFile, day: DayPrices): Content {
	const phys = cfg.physical[slot.commodity as CommodityId];
	const grams = gramsPerBtc(objs, slot.commodity as CommodityId, day) * slot.btc;
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
	} else if (slot.commodity === 'cash') {
		// cash: grams IS the note count (a $1 bill weighs exactly 1 g), and
		// the stack height follows from the BEP note thickness (0.10922 mm).
		const notes = Math.round(grams);
		const heightFt = (grams * 0.10922) / 1000 / 0.3048;
		const height = heightFt >= 1 ? `${heightFt.toFixed(1)} ft` : `${(heightFt * 12).toFixed(1)} in`;
		caption = `1 BTC today = ${notes.toLocaleString('en-US')} one-dollar bills — one stack ${height} tall. Weighs ${weight}.`;
	} else {
		// mass-only (cocaine): no cube
		caption = `1 BTC today = ${weight} of ${phys.noun}, at wholesale.`;
	}
	return { caption, btc: slot.btc, commodity: slot.commodity };
}

function buildDelta(slot: Slot, cfg: Config, objs: DeltaObjectsFile, prices: PriceData, dates: string[]): Content {
	const [pd, cd] = [dates[dates.length - 2], dates[dates.length - 1]];
	const r = computeDelta(objs, slot.commodity as CommodityId, { date: pd, day: prices[pd] }, { date: cd, day: prices[cd] });
	return { caption: r.caption, btc: slot.btc, commodity: slot.commodity };
}

function buildHashweight(eh: number): Content {
	const est = computeNetworkWeight(eh);
	const tonnes = Math.round(est.totalMassTonnes / 1000) * 1000;
	const tonnesStr = tonnes.toLocaleString('en-US');
	const titanic = est.titanicMultiple.toFixed(1);
	const hashrate = est.hashrateEH.toFixed(0);
	const caption = `The Bitcoin network's mining hardware weighs ~${tonnesStr} tonnes — about ${titanic}× the Titanic in ASICs, humming in warehouses to secure the chain. Hashrate today: ${hashrate} EH/s.`;
	return { caption, btc: 0, commodity: 'hashweight' };
}

/** Deep link back to the exact view the card is showing. */
function buildLink(cfg: Config, content: Content, dateStr: string): string {
	if (content.commodity === 'hashweight') return `${cfg.siteBase}/#hashweight`;
	return `${cfg.siteBase}/?btc=${content.btc}&commodity=${content.commodity}&date=${dateStr}`;
}

/**
 * One post/day: today's pillar is fixed by UTC weekday via `cfg.rotation`
 * (null = scheduled day off). GitHub frequently delays scheduled runs by
 * 1–4h, so matching "current hour == dailyUtcHour" exactly would silently
 * drop late runs — instead fire once the daily time has passed, as long as
 * it's no more than `slotCatchupHours` old and today's pillar hasn't
 * already posted.
 */
export function pickSlot(cfg: Config, now: Date, state: State, today: string): Slot | null {
	const explicit = arg('slot');
	if (explicit) {
		const s = cfg.slots.find((x) => x.id === explicit);
		if (!s) throw new Error(`Unknown --slot "${explicit}". Options: ${cfg.slots.map((x) => x.id).join(', ')}`);
		return s;
	}
	const slotId = cfg.rotation[now.getUTCDay()];
	if (!slotId) return null; // scheduled day off
	const slot = cfg.slots.find((x) => x.id === slotId);
	if (!slot) throw new Error(`rotation references unknown slot "${slotId}"`);
	if (state.lastSlotDate[slot.id] === today) return null; // already posted today's pillar

	const sched = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cfg.dailyUtcHour, 0, 0);
	const age = now.getTime() - sched;
	const lookbackMs = cfg.slotCatchupHours * 3_600_000;
	if (age < 0 || age > lookbackMs) return null; // not due yet, or too stale

	return slot;
}

async function main() {
	const dryRun = has('--dry-run');
	const force = has('--force'); // bypass dedup (still respects budget)
	const now = new Date();

	const [cfg, objs, prices, state] = await Promise.all([
		readJson<Config>(CONFIG_PATH),
		readJson<DeltaObjectsFile>(OBJECTS_PATH),
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
		console.log(`No pillar due at UTC hour ${now.getUTCHours()} (weekday ${now.getUTCDay()}). Rotation: ${cfg.rotation.map((s) => s ?? 'off').join(', ')}.`);
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

	// Big-move days earn the link back to the site; X bills a post with a
	// URL at ~13x a plain post ($0.20 vs $0.015), so it's reserved for
	// moves worth the spend rather than included every day.
	const dates = Object.keys(prices).sort();
	const latest = prices[dates[dates.length - 1]];
	const prevDay = dates.length >= 2 ? prices[dates[dates.length - 2]] : undefined;
	const btcPctChange = prevDay ? ((latest.btc - prevDay.btc) / prevDay.btc) * 100 : 0;
	const includeLink = Math.abs(btcPctChange) >= cfg.budget.linkThresholdPct;
	const costCents = includeLink ? cfg.budget.centsPerPostWithLink : cfg.budget.centsPerPostNoLink;

	const remainingCents = cfg.budget.balanceCents - state.creditsSpentCents;
	if (remainingCents < costCents) {
		console.log(`✗ Credit guard: ${remainingCents}c left < ${costCents}c for this post. Top up at X. Skipping.`);
		return;
	}

	// ── Content ─────────────────────────────────────────────────────
	const out = join(CARD_OUT, `${slot.id}-${today}.png`);

	let content: Content;
	let renderImage: () => Promise<string>;
	if (slot.format === 'hashweight') {
		const eh = (await fetchHashrateEH()) ?? HASHRATE_FALLBACK_EH;
		content = buildHashweight(eh);
		renderImage = () => renderHashweightCard({ out });
	} else {
		content =
			slot.format === 'delta'
				? buildDelta(slot, cfg, objs, prices, dates)
				: buildAbsolute(slot, cfg, objs, latest);
		renderImage = () =>
			renderCard({ btc: content.btc, commodity: content.commodity as string, date: dates[dates.length - 1], out });
	}

	if (includeLink) {
		console.log(`BTC moved ${btcPctChange.toFixed(1)}% today (>= ${cfg.budget.linkThresholdPct}% threshold) — including link.`);
		content.caption = `${content.caption}\n\n${buildLink(cfg, content, dates[dates.length - 1])}`;
	}

	console.log('─'.repeat(60));
	console.log(content.caption);
	console.log('─'.repeat(60));
	console.log(`caption length: ${content.caption.length}/280`);

	// ── Render card ─────────────────────────────────────────────────
	console.log(`Rendering card → ${out}`);
	const imagePath = await renderImage();
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
	state.creditsSpentCents += costCents;
	state.posts.push({ at: now.toISOString(), slot: slot.id, commodity: content.commodity, tweetId, caption: content.caption });
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
