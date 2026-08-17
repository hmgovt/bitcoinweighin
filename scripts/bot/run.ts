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
import { postTweet, replyToTweet, postThread } from './post.ts';
import { computeDelta, gramsPerBtc, type DeltaObjectsFile } from '../../src/lib/deltas.ts';
import { fetchHashrateEH, computeNetworkWeight, EIFFEL_TOWER_TONNES, STATUE_OF_LIBERTY_TONNES } from '../../src/lib/network-weight.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = join(__dirname, 'config.json');
const OBJECTS_PATH = join(PROJECT_ROOT, 'src', 'lib', 'delta-objects.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');
const STATE_PATH = join(PROJECT_ROOT, 'data', 'bot-state.json');
const CARD_OUT = join(PROJECT_ROOT, 'output', 'cards');

type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238' | 'cash';
interface Slot {
	id: string;
	commodity: CommodityId | 'hashweight' | 'thread';
	format: 'absolute' | 'delta' | 'hashweight' | 'thread';
	btc: number;
	weekday?: number; // 0-6 (UTC); if set, slot only fires on this day even in "*" rotation mode
}
interface Config {
	siteBase: string;
	handle: string;
	budget: { balanceCents: number; centsPerPostNoLink: number; centsPerPostWithLink: number; monthlyCap: number };
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

/** Deterministic template picker — same seed = same template. Reuses pickVerb's hash. */
function pickTemplate<T>(pool: T[], seed: string): T {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return pool[h % pool.length];
}

interface Content {
	caption: string;
	btc: number;
	commodity: CommodityId | 'hashweight' | 'thread';
}

function buildAbsolute(slot: Slot, cfg: Config, objs: DeltaObjectsFile, day: DayPrices, today: string): Content {
	const phys = cfg.physical[slot.commodity as CommodityId];
	const grams = gramsPerBtc(objs, slot.commodity as CommodityId, day) * slot.btc;
	const weight = fmtWeight(grams);
	const seed = today + slot.commodity;

	let caption: string;
	if (phys.shape === 'cube' && phys.densityGPerCm3) {
		const { mm } = cubeEdge(grams, phys.densityGPerCm3);
		const edge = mm < 100 ? `${mm.toFixed(0)} mm` : `${(mm / 10).toFixed(1)} cm`;
		if (phys.novelty) {
			// Pu-238: rotate through novelty framings with dwell-time hooks.
			caption = pickTemplate([
				`1 BTC today = a ${edge} cube of ${phys.noun} — the glowing isotope that powers deep-space probes. Weighs ${weight}.`,
				`Voyager runs on plutonium-238. 1 BTC buys a ${edge} cube of it — ${weight}.`,
				`What powers spacecraft for decades? Pu-238. 1 BTC = a ${edge} cube, weighing ${weight}.`,
				`NASA pays ~$5,000/g for Pu-238. 1 BTC buys ${weight} of it — a ${edge} cube of deep-space fuel.`,
				`The isotope that keeps Voyager alive: ${phys.noun}. 1 BTC = a ${edge} cube, ${weight}.`,
				`A ${edge} cube of ${phys.noun} could power a spacecraft for years. That's 1 BTC today — ${weight}.`,
			], seed);
		} else {
			// Gold / silver: rotate through cube framings with hooks.
			const palm = mm < 80 ? ' Fits in your palm.' : '';
			caption = pickTemplate([
				`1 BTC today = a ${edge} ${phys.noun} cube.${palm} Weighs ${weight}.`,
				`How big is 1 BTC in ${phys.noun}? A ${edge} cube — ${weight}.${palm}`,
				`Picture a ${phys.noun} cube ${edge} on each side. That's 1 BTC today, at ${weight}.`,
				`A single Bitcoin, made physical: a ${edge} ${phys.noun} cube weighing ${weight}.${palm}`,
				`Right now, 1 BTC buys a ${edge} ${phys.noun} cube.${palm} Total weight: ${weight}.`,
				`The weigh-in: 1 BTC = ${weight} of ${phys.noun}. That's a cube ${edge} across.`,
			], seed);
		}
	} else if (slot.commodity === 'cash') {
		// Cash: a $1 bill weighs exactly 1 g, stack height from BEP note thickness (0.10922 mm).
		const notes = Math.round(grams);
		const notesStr = notes.toLocaleString('en-US');
		const heightFt = (grams * 0.10922) / 1000 / 0.3048;
		const height = heightFt >= 1 ? `${heightFt.toFixed(1)} ft` : `${(heightFt * 12).toFixed(1)} in`;
		caption = pickTemplate([
			`1 BTC today = ${notesStr} one-dollar bills — one stack ${height} tall. Weighs ${weight}.`,
			`Stack ${notesStr} singles and you've got 1 BTC — ${height} of paper, weighing ${weight}.`,
			`How tall is 1 BTC in dollar bills? ${height}. That's ${notesStr} notes, ${weight}.`,
			`1 BTC, cashed out in singles: ${notesStr} bills, stacked ${height} high. Weight: ${weight}.`,
			`Every dollar bill weighs 1 gram. 1 BTC = ${notesStr} of them — ${height} tall, ${weight}.`,
		], seed);
	} else {
		// Mass-only (cocaine): no cube, rotate through wholesale framings.
		caption = pickTemplate([
			`1 BTC today = ${weight} of ${phys.noun}, at wholesale.`,
			`At wholesale prices, 1 BTC buys ${weight} of ${phys.noun}.`,
			`The black market, weighed: 1 BTC = ${weight} of ${phys.noun} at wholesale.`,
			`How much ${phys.noun} does 1 BTC buy? ${weight}, at wholesale prices.`,
			`1 BTC on the wholesale market: ${weight} of ${phys.noun}. The underground economy, quantified.`,
		], seed);
	}
	return { caption, btc: slot.btc, commodity: slot.commodity };
}

function buildDelta(slot: Slot, cfg: Config, objs: DeltaObjectsFile, prices: PriceData, dates: string[]): Content {
	const [pd, cd] = [dates[dates.length - 2], dates[dates.length - 1]];
	const r = computeDelta(objs, slot.commodity as CommodityId, { date: pd, day: prices[pd] }, { date: cd, day: prices[cd] });
	return { caption: r.caption, btc: slot.btc, commodity: slot.commodity };
}

function buildHashweight(eh: number, today: string): Content {
	const est = computeNetworkWeight(eh);
	const tonnes = Math.round(est.totalMassTonnes / 1000) * 1000;
	const tonnesStr = tonnes.toLocaleString('en-US');
	const titanic = est.titanicMultiple.toFixed(1);
	const hashrate = est.hashrateEH.toFixed(0);
	const eiffel = (est.totalMassTonnes / EIFFEL_TOWER_TONNES).toFixed(0);
	const liberty = Math.round(est.totalMassTonnes / STATUE_OF_LIBERTY_TONNES).toLocaleString('en-US');
	const asicMillions = (est.asicCount / 1_000_000).toFixed(1);

	const caption = pickTemplate([
		`The Bitcoin network's mining hardware weighs ~${tonnesStr} tonnes — about ${titanic}× the Titanic in ASICs. Hashrate: ${hashrate} EH/s.`,
		`How much does Bitcoin weigh? ~${tonnesStr} tonnes of mining rigs — ${eiffel}× the Eiffel Tower's steel. Hashrate: ${hashrate} EH/s.`,
		`~${asicMillions}M ASICs hum in warehouses worldwide, weighing ~${tonnesStr} tonnes — ${titanic}× the Titanic. Hashrate: ${hashrate} EH/s.`,
		`Bitcoin's physical footprint: ~${tonnesStr} tonnes of mining hardware, ${liberty}× the Statue of Liberty. Hashrate: ${hashrate} EH/s.`,
		`The chain is secured by ~${tonnesStr} tonnes of ASICs — about ${titanic}× the Titanic's mass, at ${hashrate} EH/s of hashpower.`,
		`Imagine ${eiffel} Eiffel Towers, melted into mining rigs. That's Bitcoin today: ~${tonnesStr} tonnes at ${hashrate} EH/s.`,
	], today + 'hashweight');

	return { caption, btc: 0, commodity: 'hashweight' };
}

/**
 * Build a weekly roundup thread (3 tweets).
 * Threads get 40-60% more total impressions — each tweet in the thread gets
 * its own velocity score while cross-pollinating impressions. The link goes
 * in the final tweet naturally (no penalty, since thread-expanders show it).
 *
 * Tweet 1: hook with gold card image
 * Tweet 2: other commodity highlights
 * Tweet 3: CTA with site link
 */
function buildWeeklyThread(
	cfg: Config,
	objs: DeltaObjectsFile,
	prices: PriceData,
	dates: string[],
	today: string,
): { tweets: Array<{ text: string; imagePath?: string }>; imageDateStr: string } | null {
	const latest = prices[dates[dates.length - 1]];
	if (!latest) return null;

	// Compute current commodity weights for the roundup.
	const goldG = gramsPerBtc(objs, 'gold', latest);
	const silverG = gramsPerBtc(objs, 'silver', latest);
	const cocaineG = gramsPerBtc(objs, 'cocaine', latest);
	const cashG = gramsPerBtc(objs, 'cash' as CommodityId, latest);

	const goldEdgeMm = cubeEdge(goldG, cfg.physical.gold.densityGPerCm3!).mm;
	const goldEdge = goldEdgeMm < 100 ? `${goldEdgeMm.toFixed(0)} mm` : `${(goldEdgeMm / 10).toFixed(1)} cm`;
	const silverEdgeMm = cubeEdge(silverG, cfg.physical.silver.densityGPerCm3!).mm;
	const silverEdge = silverEdgeMm < 100 ? `${silverEdgeMm.toFixed(0)} mm` : `${(silverEdgeMm / 10).toFixed(1)} cm`;

	const goldWeight = fmtWeight(goldG);
	const silverWeight = fmtWeight(silverG);
	const cocaineWeight = fmtWeight(cocaineG);
	const cashNotes = Math.round(cashG).toLocaleString('en-US');

	// Tweet 1: hook
	const hook = pickTemplate([
		`Weekly Bitcoin Weigh-In\n\nWhat does 1 BTC look like, made physical? This week's numbers:`,
		`This week's Bitcoin Weigh-In\n\nEvery day we weigh Bitcoin against real commodities. Here's where it stands:`,
		`The weekly weigh-in is in.\n\n1 BTC, converted to atoms you can hold — the numbers might surprise you:`,
	], today + 'thread-hook');

	// Tweet 2: commodity highlights
	const highlights = pickTemplate([
		`Gold: a ${goldEdge} cube (${goldWeight})\nSilver: a ${silverEdge} cube (${silverWeight})\nCocaine: ${cocaineWeight} at wholesale\nCash: ${cashNotes} dollar bills`,
		`${goldWeight} of gold — a cube ${goldEdge} across\n${silverWeight} of silver — ${silverEdge} wide\n${cocaineWeight} of cocaine at wholesale\n${cashNotes} one-dollar bills`,
		`A ${goldEdge} gold cube weighing ${goldWeight}\nA ${silverEdge} silver cube at ${silverWeight}\n${cocaineWeight} of wholesale cocaine\n${cashNotes} singles in a stack`,
	], today + 'thread-body');

	// Tweet 3: CTA with link (link is natural in the final tweet — no penalty)
	const link = `${cfg.siteBase}/?btc=1&commodity=gold&date=${dates[dates.length - 1]}`;
	const utmLink = link + '&utm_source=x&utm_medium=weekly_thread&utm_campaign=bot';
	const cta = `Explore the live interactive weigh-in — every commodity, every day → ${utmLink}`;

	return {
		tweets: [
			{ text: hook },    // image added by caller (gold card)
			{ text: highlights },
			{ text: cta },
		],
		imageDateStr: dates[dates.length - 1],
	};
}

/**
 * Send a push notification so the account owner can reply quickly.
 * X algorithm gives author replies +75 weight (150× a like), but velocity
 * in the first 15-30 min matters most — hence the immediate notification.
 * Uses a Discord-compatible webhook format (also works with many generic
 * webhook consumers). Set NOTIFY_WEBHOOK_URL in env / secrets to enable.
 */
async function sendNotification(cfg: Config, tweetId: string, caption: string, slot: Slot): Promise<void> {
	const url = process.env.NOTIFY_WEBHOOK_URL;
	if (!url) return;

	const tweetUrl = `https://x.com/${cfg.handle}/status/${tweetId}`;
	const payload = {
		content: `New @${cfg.handle} post is live — reply within 15 min for max algo boost!\n\n${caption}\n\n${tweetUrl}`,
		username: 'Bitcoin Weigh-In Bot',
		embeds: [{
			title: `${slot.id} posted`,
			url: tweetUrl,
			description: caption,
			color: 0xf7931a, // Bitcoin orange
		}],
	};

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (res.ok) {
			console.log('✓ Notification sent');
		} else {
			console.warn(`⚠ Notification failed: ${res.status} ${res.statusText}`);
		}
	} catch (err: any) {
		console.warn(`⚠ Notification error: ${err?.message || err}`);
	}
}

/** Deep link back to the exact view the card is showing. */
function buildLink(cfg: Config, content: Content, dateStr: string): string {
	if (content.commodity === 'hashweight') return `${cfg.siteBase}/#hashweight`;
	return `${cfg.siteBase}/?btc=${content.btc}&commodity=${content.commodity}&date=${dateStr}`;
}

/**
 * Pick the slot to post right now.
 *
 * Rotation values per weekday:
 *   null  → scheduled day off (no posts)
 *   "*"   → post ALL slots today, one per cron invocation (first unposted wins)
 *   "id"  → post exactly that one slot (legacy one-per-day mode)
 *
 * GitHub frequently delays scheduled runs by 1–4h, so matching
 * "current hour == dailyUtcHour" exactly would silently drop late runs —
 * instead fire once the daily time has passed, as long as it's no more
 * than `slotCatchupHours` old.
 */
export function pickSlot(cfg: Config, now: Date, state: State, today: string): Slot | null {
	const explicit = arg('slot');
	if (explicit) {
		const s = cfg.slots.find((x) => x.id === explicit);
		if (!s) throw new Error(`Unknown --slot "${explicit}". Options: ${cfg.slots.map((x) => x.id).join(', ')}`);
		return s;
	}

	const sched = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cfg.dailyUtcHour, 0, 0);
	const age = now.getTime() - sched;
	const lookbackMs = cfg.slotCatchupHours * 3_600_000;
	if (age < 0 || age > lookbackMs) return null; // not due yet, or too stale

	const rotationEntry = cfg.rotation[now.getUTCDay()];
	if (!rotationEntry) return null; // scheduled day off

	if (rotationEntry === '*') {
		// All-slots mode: return the first slot that hasn't posted today.
		// Slots with a weekday constraint only fire on their designated day.
		const dow = now.getUTCDay();
		const next = cfg.slots.find((s) =>
			state.lastSlotDate[s.id] !== today &&
			(s.weekday === undefined || s.weekday === dow),
		);
		return next ?? null; // null if all eligible slots already posted today
	}

	// Legacy single-slot mode.
	const slot = cfg.slots.find((x) => x.id === rotationEntry);
	if (!slot) throw new Error(`rotation references unknown slot "${rotationEntry}"`);
	if (state.lastSlotDate[slot.id] === today) return null;
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

	const dates = Object.keys(prices).sort();
	const latest = prices[dates[dates.length - 1]];

	// ── Cost & credit guard ─────────────────────────────────────────
	// Regular posts: 2-tweet sequence (image+caption, then first-reply with link).
	// Threads: N tweets (last one has the link, rest are text/image only).
	const isThread = slot.format === 'thread';
	const costCents = isThread
		? cfg.budget.centsPerPostNoLink * 2 + cfg.budget.centsPerPostWithLink // 3-tweet thread
		: cfg.budget.centsPerPostNoLink + cfg.budget.centsPerPostWithLink;    // standard 2-tweet

	const remainingCents = cfg.budget.balanceCents - state.creditsSpentCents;
	if (remainingCents < costCents) {
		console.log(`✗ Credit guard: ${remainingCents}c left < ${costCents}c for this post. Top up at X or migrate to OpenTweet. Skipping.`);
		return;
	}

	// ── Thread format ───────────────────────────────────────────────
	if (isThread) {
		const thread = buildWeeklyThread(cfg, objs, prices, dates, today);
		if (!thread) {
			console.log('Not enough data for weekly thread. Skipping.');
			return;
		}

		console.log('─'.repeat(60));
		thread.tweets.forEach((t, i) => {
			console.log(`THREAD ${i + 1}/${thread.tweets.length}:`);
			console.log(t.text);
			console.log(`  (${t.text.length}/280 chars)`);
			console.log('');
		});
		console.log('─'.repeat(60));

		// Check all tweets fit under 280.
		const overlong = thread.tweets.find((t) => t.text.length > 280);
		if (overlong) {
			console.error(`✗ Thread tweet exceeds 280 chars (${overlong.text.length}). Aborting.`);
			return;
		}

		// Render gold card for the thread opener image.
		const out = join(CARD_OUT, `${slot.id}-${today}.png`);
		console.log(`Rendering gold card for thread → ${out}`);
		const imagePath = await renderCard({ btc: 1, commodity: 'gold', date: thread.imageDateStr, out });
		thread.tweets[0].imagePath = imagePath;
		console.log(`  ✓ ${imagePath}`);

		if (dryRun) {
			console.log('✓ Dry run complete — nothing posted, state unchanged.');
			return;
		}

		const ids = await postThread(thread.tweets);
		const tweetId = ids[0];
		console.log(`✓ Thread posted (${ids.length} tweets): https://x.com/${cfg.handle}/status/${tweetId}`);

		await sendNotification(cfg, tweetId, thread.tweets[0].text, slot);

		// Record state — use the first tweet's id as the post identifier.
		state.lastSlotDate[slot.id] = today;
		state.postsThisMonth += ids.length;
		state.creditsSpentCents += costCents;
		state.posts.push({ at: now.toISOString(), slot: slot.id, commodity: 'thread' as string, tweetId, caption: thread.tweets[0].text });
		if (state.posts.length > 200) state.posts = state.posts.slice(-200);
		await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
		console.log(`State updated: ${state.postsThisMonth}/${cfg.budget.monthlyCap} this month, ${cfg.budget.balanceCents - state.creditsSpentCents}c left.`);
		return;
	}

	// ── Standard post (image + caption, then first-reply with link) ─
	const out = join(CARD_OUT, `${slot.id}-${today}.png`);

	let content: Content;
	let renderImage: () => Promise<string>;
	if (slot.format === 'hashweight') {
		const eh = (await fetchHashrateEH()) ?? HASHRATE_FALLBACK_EH;
		content = buildHashweight(eh, today);
		renderImage = () => renderHashweightCard({ out });
	} else {
		content =
			slot.format === 'delta'
				? buildDelta(slot, cfg, objs, prices, dates)
				: buildAbsolute(slot, cfg, objs, latest, today);
		renderImage = () =>
			renderCard({ btc: content.btc, commodity: content.commodity as string, date: dates[dates.length - 1], out });
	}

	// Build the first-reply link with UTM tracking.
	const dateStr = dates[dates.length - 1];
	const siteLink = buildLink(cfg, content, dateStr);
	const utmLink = siteLink + (siteLink.includes('?') ? '&' : '?') + 'utm_source=x&utm_medium=first_reply&utm_campaign=bot';
	const replyText = `Explore the live interactive weigh-in → ${utmLink}`;

	console.log('─'.repeat(60));
	console.log('MAIN TWEET:');
	console.log(content.caption);
	console.log('');
	console.log('FIRST REPLY:');
	console.log(replyText);
	console.log('─'.repeat(60));
	console.log(`caption length: ${content.caption.length}/280 | reply length: ${replyText.length}/280`);

	if (replyText.length > 280) {
		console.warn(`Reply is ${replyText.length} chars — falling back to link without UTM.`);
	}

	// ── Render card ─────────────────────────────────────────────────
	console.log(`Rendering card → ${out}`);
	const imagePath = await renderImage();
	console.log(`  ✓ ${imagePath}`);

	if (dryRun) {
		console.log('✓ Dry run complete — nothing posted, state unchanged.');
		return;
	}

	// ── Post main tweet (image + caption, NO link) ──────────────────
	const tweetId = await postTweet(imagePath, content.caption);
	console.log(`✓ Posted: https://x.com/${cfg.handle}/status/${tweetId}`);

	// ── First reply (link to site) ──────────────────────────────────
	const finalReply = replyText.length <= 280 ? replyText : `Explore the live weigh-in → ${siteLink}`;
	try {
		const replyId = await replyToTweet(tweetId, finalReply);
		console.log(`✓ First reply: https://x.com/${cfg.handle}/status/${replyId}`);
	} catch (err: any) {
		console.error(`⚠ First reply failed (main tweet is live): ${err?.message || err}`);
	}

	// ── Notify owner to reply (algo signal: author reply = +75) ─────
	await sendNotification(cfg, tweetId, content.caption, slot);

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
