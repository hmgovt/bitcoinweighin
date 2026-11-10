/**
 * dry-run.ts — what the reply radar would have flagged over the last N hours.
 *
 * Reads each watchlist account's recent posts from TwitterAPI.io, keeps the
 * ones posted inside the waking window that took off fast, matches each to one
 * of our angles, drafts a reply with live figures, and prints the list (and,
 * with --discord, posts it as one digest to DISCORD_WEBHOOK_URL).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/dry-run.ts [--hours=24] [--discord] [--verify]
 *
 * --verify only checks the handles exist and prints their follower counts.
 * Needs TWITTERAPI_IO_KEY (and DISCORD_WEBHOOK_URL for --discord).
 */
import { draftReply, type Draft } from './angles.ts';
import { api, costLine, handlesOf, heat, hm, loadWatchlist, localMinutes, recentPosts, type Post } from './api.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const hours = Number(arg('hours') ?? 24);

async function main() {
	const wl = await loadWatchlist();
	const handles = handlesOf(wl);

	if (process.argv.includes('--verify')) {
		for (const { h, group } of handles) {
			try {
				const r = await api<{ data?: { userName: string; name: string; followers: number } }>(`/user/info?userName=${h}`);
				console.log(`${r.data ? '✓' : '✗'} ${group.padEnd(11)} @${h.padEnd(16)} ${r.data ? `${(r.data.followers / 1000).toFixed(0)}k  ${r.data.name}` : 'not found'}`);
			} catch (e) {
				console.log(`✗ ${group.padEnd(11)} @${h.padEnd(16)} ${(e as Error).message}`);
			}
		}
		return;
	}

	const since = Date.now() - hours * 3600_000;
	const from = hm(wl.hours.from), to = hm(wl.hours.to);
	const candidates: { p: Post; group: string; heat: number; draft: Draft | null }[] = [];
	for (const { h, group } of handles) {
		let posts: Post[] = [];
		try { posts = await recentPosts(h); } catch (e) { console.warn(`@${h}: ${(e as Error).message}`); continue; }
		for (const p of posts) {
			const t = new Date(p.createdAt);
			if (t.getTime() < since) continue;
			const lm = localMinutes(t, wl.hours.tz);
			if (lm < from || lm > to) continue;
			candidates.push({ p, group, heat: heat(p), draft: await draftReply(p, group) });
		}
	}
	// One per account (its hottest matched post), then the day's cap, hottest first.
	const best = new Map<string, (typeof candidates)[number]>();
	for (const c of candidates) {
		if (!c.draft) continue;
		const k = c.p.author.userName.toLowerCase();
		const cur = best.get(k);
		const boost = (x: typeof c) => x.heat * (wl.priority.map((s) => s.toLowerCase()).includes(k) ? 2 : 1);
		if (!cur || boost(c) > boost(cur)) best.set(k, c);
	}
	// The same reply twice in a day reads as spam: keep only the hottest post per draft.
	const used = new Set<string>();
	const picks = [...best.values()]
		.sort((a, b) => b.heat - a.heat)
		.filter((c) => !used.has(c.draft!.text) && !!used.add(c.draft!.text))
		.slice(0, wl.limits.perDay);

	console.log(costLine());
	console.log(`${candidates.length} posts in the window from ${handles.length} accounts; ${candidates.filter((c) => c.draft).length} matched an angle; ${picks.length} would have been alerts.\n`);
	const lines: string[] = [];
	for (const c of picks) {
		const when = new Intl.DateTimeFormat('en-GB', { timeZone: wl.hours.tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(c.p.createdAt));
		const block = [
			`**@${c.p.author.userName}** · ${when} · ${c.p.likeCount.toLocaleString('en-US')} likes · heat ${c.heat.toFixed(2)}/h · angle: ${c.draft!.angle}`,
			`> ${c.p.text.replace(/\s+/g, ' ').slice(0, 220)}`,
			`Reply: ${c.draft!.text}`,
			`<${c.p.url}>`,
		].join('\n');
		lines.push(block);
		console.log(block.replace(/\*\*/g, '') + '\n');
	}

	if (process.argv.includes('--discord') && lines.length) {
		const url = process.env.DISCORD_WEBHOOK_URL;
		if (!url) throw new Error('DISCORD_WEBHOOK_URL is not set');
		const chunks: string[] = [`**Reply radar dry run:** the ${picks.length} posts it would have flagged in the last ${hours} hours (09:00–23:30 UK). Not live yet; nothing to do.`];
		for (const l of lines) {
			if ((chunks[chunks.length - 1] + '\n\n' + l).length > 1900) chunks.push(l);
			else chunks[chunks.length - 1] += '\n\n' + l;
		}
		for (const content of chunks) {
			const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Bitcoin Weigh-In radar', content }) });
			if (!r.ok) throw new Error(`Discord ${r.status}`);
		}
		console.log(`posted ${chunks.length} message(s) to Discord`);
	}
}

main().catch((e) => { console.error(e); process.exit(1); });
