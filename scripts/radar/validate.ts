/**
 * validate.ts — checks a reply draft before it reaches a person.
 *
 * The rule that matters: every number in the draft must come from the fact
 * sheet, the post itself, or a worked step ("derived") built only from those.
 * Rounding is fine (within 2%); a figure from nowhere is not.
 */

export interface Derived { value: number; expr: string }
export interface Option { text: string; link?: string; derived?: Derived[] }

/** Numbers that need no source: small counts and years. */
const FREE = (n: number, raw: string) => (Number.isInteger(n) && n >= 0 && n <= 12) || (/^\d{4}$/.test(raw) && n >= 1990 && n <= 2100);

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, b: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };

/** Every number in a text, with scale words applied ($40 trillion → 4e13, 21M → 2.1e7). */
export function numbersIn(text: string): { value: number; raw: string; base: number }[] {
	const clean = text.replace(/https?:\/\/\S+/g, ' ').replace(/@\w+/g, ' ').replace(/\[[\w-]+\]/g, ' ');
	const out: { value: number; raw: string; base: number }[] = [];
	for (const m of clean.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?:\s?(thousand|million|billion|trillion|bn|[kKmMbBtT])\b)?/g)) {
		const raw = m[1] + (m[2] ?? '');
		const base = Number(raw.replace(/,/g, ''));
		const scale = m[3] ? SCALE[m[3].toLowerCase()] ?? 1 : 1;
		out.push({ value: base * scale, raw, base });
		// A lone letter may be a unit, not a scale ("9.23 m tall", "310 t"), so keep the bare reading too.
		if (scale !== 1 && m[3]!.length === 1) out.push({ value: base, raw, base });
	}
	return out;
}

const close = (a: number, b: number, tol = 0.02) => a === b || (b !== 0 && Math.abs(a - b) / Math.abs(b) <= tol);

/** Evaluate a worked step like "537 / 310" — digits, operators and brackets only. */
export function evalExpr(expr: string): number | null {
	if (!/^[\d\s.,+\-*/()]+$/.test(expr)) return null;
	try {
		const v = Function(`"use strict"; return (${expr.replace(/,(?=\d{3}\b)/g, '')});`)() as unknown;
		return typeof v === 'number' && isFinite(v) ? v : null;
	} catch { return null; }
}

export interface Check { ok: boolean; problems: string[] }

/** Fact-sheet lines that only say what one coin is worth today: true under any post. */
const GENERIC = new Set(['close', 'gold-1', 'silver-1', 'cash-1', 'manhattan-1', 'cocaine-1', 'pu238-1', 'oil-1']);
/** Posts that are about one of those things, where restating it is an answer. */
const ABOUT_COMMODITY = /\b(gold|silver|dollars?|cash|bills?|banknotes?|manhattan|cocaine|plutonium|oil|brent)\b/i;

/**
 * A reply whose every figure could come from the one-coin lines, under a post
 * that isn't about those things: it ignores the post (a bank's custody news
 * answered with what a bitcoin weighs in gold). Such a draft is refused.
 */
export function isGeneric(text: string, sources: string[], post: string): boolean {
	if (ABOUT_COMMODITY.test(post)) return false;
	const nums = numbersIn(text).filter((n) => !FREE(n.value, n.raw));
	if (!nums.length) return false;
	const lines = sources.map((l) => ({ id: /^\[([\w-]+)\]/.exec(l)?.[1] ?? '', vals: numbersIn(l).map((n) => n.value) }));
	// Generic when every figure could have come from a one-coin line (the price
	// itself shows up in other lines too, so "only from" would never fire).
	return nums.every((n) => lines.some((l) => GENERIC.has(l.id) && l.vals.some((v) => close(n.value, v))));
}

export function checkOption(opt: Option, sources: string[], allowedLinks: string[], recent: string[] = [], post?: string): Check {
	const problems: string[] = [];
	const found = sources.flatMap((s) => numbersIn(s));
	const known = found.map((n) => n.value);
	const ok = (v: number) => known.some((k) => close(v, k));
	// A worked step may write "$71.7 billion" as 71.7 * 1000000000.
	const bases = found.map((n) => n.base);
	const okInStep = (v: number) => ok(v) || bases.some((k) => close(v, k, 0.005));

	// Worked steps may only use known numbers; their results become known too.
	for (const d of opt.derived ?? []) {
		const literals = numbersIn(d.expr).map((n) => n.value);
		const unit = (v: number) => v > 0 && Number.isInteger(Math.log10(v)); // 1000, 1e9: unit conversions
		const bad = literals.filter((v) => !okInStep(v) && !FREE(v, String(v)) && !unit(v));
		const v = evalExpr(d.expr);
		if (bad.length) problems.push(`worked step "${d.expr}" uses unsourced ${bad.join(', ')}`);
		else if (v === null) problems.push(`worked step "${d.expr}" isn't plain arithmetic`);
		else if (!close(d.value, v)) problems.push(`worked step "${d.expr}" gives ${v}, not ${d.value}`);
		else known.push(v);
	}

	const seen = new Set<string>();
	for (const n of numbersIn(opt.text)) {
		if (FREE(n.value, n.raw) || ok(n.value) || seen.has(n.raw)) continue;
		// A scaled number passes if either reading is known; numbersIn yields both.
		const twins = numbersIn(opt.text).filter((x) => x.raw === n.raw);
		if (twins.some((x) => ok(x.value))) { seen.add(n.raw); continue; }
		problems.push(`${n.raw} has no source`);
		seen.add(n.raw);
	}

	if (post !== undefined && isGeneric(opt.text, sources, post)) problems.push('generic: only says what one bitcoin is worth, not what the post is about');
	if (/#\w/.test(opt.text)) problems.push('has a hashtag');
	if (/https?:\/\//.test(opt.text)) problems.push('link belongs in the link field, not the text');
	if (opt.link && !allowedLinks.includes(opt.link)) problems.push('link is not one of ours');
	// X counts any link as 23 characters.
	const len = [...opt.text].length + (opt.link ? 24 : 0);
	if (len > 280) problems.push(`${len} characters with the link (max 280)`);
	if (opt.text.trim().length < 20) problems.push('too short');
	const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	if (recent.some((r) => norm(r) === norm(opt.text))) problems.push('repeats a recent reply');
	return { ok: problems.length === 0, problems };
}
