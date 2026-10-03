/**
 * alert.ts — sends the radar's candidates to Discord, each with the best
 * checked draft reply.
 *
 * Reads output/radar/candidates.json (from sweep.ts) and, if Claude ran,
 * output/radar/drafts.json. Every draft option goes through validate.ts; one
 * that fails is dropped. A candidate with no passing option falls back to its
 * template reply, marked as such, so a hot post is never missed. Posts Claude
 * chose to skip get one line in a roll-up instead of an alert.
 *
 *   npx tsx scripts/radar/alert.ts [--dry]
 *
 * Needs DISCORD_WEBHOOK_URL (unless --dry). Never log it.
 */
import { readFileSync } from 'node:fs';
import { loadWatchlist } from './api.ts';
import { loadState, saveState, type Candidate } from './sweep.ts';
import { checkOption, type Option } from './validate.ts';

interface Draft { id: string; skip?: boolean; reason?: string; options?: Option[] }

const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'output/radar';
const dry = process.argv.includes('--dry');

function readJson<T>(path: string): T | null {
	try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return null; }
}

async function send(content: string) {
	if (dry) { console.log(content + '\n---'); return; }
	const url = process.env.DISCORD_WEBHOOK_URL;
	if (!url) throw new Error('DISCORD_WEBHOOK_URL is not set');
	const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Bitcoin Weigh-In radar', content: content.slice(0, 2000), allowed_mentions: { parse: [] } }) });
	if (!r.ok) throw new Error(`Discord ${r.status}`);
}

async function main() {
	const { candidates = [] } = readJson<{ candidates: Candidate[] }>(`${OUT}/candidates.json`) ?? {};
	if (!candidates.length) { console.log('No candidates.'); return; }
	const drafts = readJson<{ drafts: Draft[] }>(`${OUT}/drafts.json`)?.drafts;
	const wl = await loadWatchlist();
	const state = loadState();
	const recent = state.recentReplies.map((r) => r.text);
	const skipped: string[] = [];
	let sent = 0;

	for (const c of candidates) {
		const d = drafts?.find((x) => x.id === c.id);
		const sources = [...c.facts, c.text];
		const links = Object.values(c.links);
		const passing: Option[] = [];
		const rejected: string[] = [];
		for (const raw of d?.options ?? []) {
			// A link given by its key ("moon") means that link; any other stray link is dropped, not the reply.
			const link = raw.link && (c.links[raw.link] ?? raw.link);
			const o: Option = { ...raw, link: link && links.includes(link) ? link : '' };
			const r = checkOption(o, sources, links, recent);
			if (r.ok) passing.push(o); else rejected.push(r.problems.join('; '));
		}
		if (d?.skip && !passing.length) { skipped.push(`@${c.author}: ${d.reason ?? 'no angle'} <${c.url}>`); continue; }

		const when = new Intl.DateTimeFormat('en-GB', { timeZone: wl.hours.tz, hour: '2-digit', minute: '2-digit' }).format(new Date(c.createdAt));
		const lines = [
			`**@${c.author}** · ${when} · ${c.ageMinutes} min old · ${c.likes.toLocaleString('en-US')} likes · ${c.reposts.toLocaleString('en-US')} reposts · heat ${c.heat}/h`,
			`> ${c.text.replace(/\s+/g, ' ').slice(0, 280)}`,
		];
		const fmt = (o: Option) => `${o.text}${o.link ? `\n<${o.link}>` : ''}`;
		if (passing.length) {
			lines.push(`**Reply:** ${fmt(passing[0])}`);
			if (passing[1]) lines.push(`**Or:** ${fmt(passing[1])}`);
			if (d?.reason) lines.push(`-# ${d.reason}`);
		} else if (c.fallback) {
			const why = !drafts ? 'Claude draft unavailable' : !d ? 'no Claude draft for this post' : `Claude drafts failed checks: ${rejected.join(' | ').slice(0, 300)}`;
			lines.push(`**Reply (template):** ${c.fallback.text}`, `-# ${why}`);
		} else {
			lines.push('-# No draft passed checks; reply by hand if it’s worth it.');
		}
		lines.push(`Open: <${c.url}>`);
		await send(lines.join('\n'));
		sent++;
		for (const o of passing.slice(0, 2)) state.recentReplies.push({ text: o.text, at: Math.floor(Date.now() / 1000) });
	}
	if (skipped.length) await send(`-# Radar skipped ${skipped.length} hot post${skipped.length > 1 ? 's' : ''} with no strong angle:\n${skipped.map((s) => `-# ${s}`).join('\n')}`);

	if (!dry) saveState(state);
	console.log(`Sent ${sent} alert(s); skipped ${skipped.length}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
