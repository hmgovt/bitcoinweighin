# Cash (Dollar-Bill-Stack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "Cash" as a 5th hero commodity on Bitcoin Weigh-In — a real WebGL 3D dollar-bill stack (built from the user's `assets/blender/one_dollar_bill.glb` mesh with a procedural stylized texture, not the watermarked stock photo baked into the source file), toggleable between an auto-tiered "roughly cubic" bundled view and a literal true-height single column, with full SEO/content parity with the other four launch commodities (Gold, Silver, Pu-238, Cocaine).

**Architecture:** Note count is derived exactly (`noteCount = btcAmount × liveBtcUsdPrice`, since one $1 note = $1 by definition — no market-price lookup, unlike every other commodity). A new pure-math module (`billStack.ts`) computes stack height, tier selection, a "roughly-cubic" bundle-grid layout, and a human-scale comparison ladder — all from the U.S. Bureau of Engraving and Printing's official note dimensions. A new WebGL scene (`BillStage.svelte`, sibling to the existing `LiveStage.svelte`) renders the tiers using `THREE.InstancedMesh` for small counts and coalesced textured blocks for large counts, reusing the site's existing camera-dolly maths unchanged. Full spec: [`docs/handoff/14-cash.md`](../../handoff/14-cash.md).

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Three.js (raw, no framework wrapper), Vitest, `@gltf-transform/core` + CLI for the asset pipeline.

## Global Constraints

- Physical constants are the U.S. Bureau of Engraving and Printing's published note dimensions, identical for every denomination: length 155.956 mm (6.14 in), width 66.294 mm (2.61 in), thickness 0.10922 mm (0.0043 in), mass 1 g. These are regression-pinned — do not "round for simplicity" anywhere in this plan.
- Pricing is exact by construction (1 note = $1), not a market estimate — do not add an "illustrative" caveat to Cash's copy anywhere.
- The source `assets/blender/one_dollar_bill.glb`'s embedded texture is a watermarked stock photo and must never reach the browser — every task touching that asset strips the texture before the file leaves the build pipeline. The bill's visible face comes from a procedurally-generated, stylized (not photo-real, not a reproduction of genuine currency artwork) `CanvasTexture` applied at runtime.
- No new npm dependencies. `three`, `@gltf-transform/core`, `@gltf-transform/cli` are already installed; everything else (procedural textures, instancing) uses APIs already in use elsewhere in this codebase.
- Follow existing patterns: pure logic in `src/lib/*.ts` (tested in `tests/*.test.ts` via Vitest, `../src/lib/...js` import paths), WebGL-only code isolated to `src/lib/scene/*` (client-only, dynamic-imported), Svelte 5 runes (`$state`, `$derived`, `$props`) not Svelte 4 syntax.
- Every commit message follows this repo's Conventional Commits style (see recent `git log`), no AI attribution trailer (already disabled repo-wide per user's git-workflow preference).

---

## Task 1: Physical constants and stack height

**Files:**
- Create: `src/lib/billStack.ts`
- Test: `tests/bill-stack.test.ts`

**Interfaces:**
- Produces: `BILL_LENGTH_MM`, `BILL_WIDTH_MM`, `BILL_THICKNESS_MM`, `BILL_MASS_G` (all `number`), `stackHeightMm(noteCount: number): number`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/bill-stack.test.ts
import { describe, it, expect } from 'vitest';
import {
	BILL_LENGTH_MM,
	BILL_WIDTH_MM,
	BILL_THICKNESS_MM,
	BILL_MASS_G,
	stackHeightMm,
} from '../src/lib/billStack.js';

describe('physical constants', () => {
	it('match the Bureau of Engraving and Printing published dimensions', () => {
		expect(BILL_LENGTH_MM).toBeCloseTo(155.956, 3);
		expect(BILL_WIDTH_MM).toBeCloseTo(66.294, 3);
		expect(BILL_THICKNESS_MM).toBeCloseTo(0.10922, 5);
		expect(BILL_MASS_G).toBe(1);
	});

	it('a strap of 100 notes is ~0.43 in thick (BEP public trivia cross-check)', () => {
		const strapThicknessIn = (100 * BILL_THICKNESS_MM) / 25.4;
		expect(strapThicknessIn).toBeCloseTo(0.43, 2);
	});
});

describe('stackHeightMm', () => {
	it('returns 0 for zero or negative counts', () => {
		expect(stackHeightMm(0)).toBe(0);
		expect(stackHeightMm(-5)).toBe(0);
	});

	it('110 notes -> ~12.01 mm (the 0.001 BTC worked example)', () => {
		expect(stackHeightMm(110)).toBeCloseTo(12.0142, 3);
	});

	it('110,000 notes -> ~12,014.2 mm (the 1 BTC worked example)', () => {
		expect(stackHeightMm(110_000)).toBeCloseTo(12_014.2, 1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: FAIL — `src/lib/billStack.ts` does not exist

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/billStack.ts
/**
 * Pure geometry/tier maths for the Cash commodity — a WebGL stack of $1
 * bills. Every constant below is the U.S. Bureau of Engraving and
 * Printing's published note dimension, identical across denominations.
 * See docs/handoff/14-cash.md for the full spec and worked examples.
 */

export const BILL_LENGTH_MM = 155.956; // 6.14 in
export const BILL_WIDTH_MM = 66.294; // 2.61 in
export const BILL_THICKNESS_MM = 0.10922; // 0.0043 in
export const BILL_MASS_G = 1;

/** Total height of a straight stack of `noteCount` notes, in millimetres. */
export function stackHeightMm(noteCount: number): number {
	if (!(noteCount > 0)) return 0;
	return noteCount * BILL_THICKNESS_MM;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/billStack.ts tests/bill-stack.test.ts
git commit -m "feat: add bill physical constants and stack height maths"
```

---

## Task 2: Tier selection

**Files:**
- Modify: `src/lib/billStack.ts`
- Test: `tests/bill-stack.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `type BillTier = 'loose' | 'strap' | 'bundle' | 'cube' | 'pallet'`, `NOTES_PER_STRAP`, `NOTES_PER_BUNDLE`, `CUBE_TIER_MIN_NOTES`, `PALLET_TIER_MIN_NOTES` (all `number`), `selectBillTier(noteCount: number): BillTier | null`

- [ ] **Step 1: Write the failing test**

```typescript
// append to tests/bill-stack.test.ts
import { selectBillTier } from '../src/lib/billStack.js';

describe('selectBillTier', () => {
	it('returns null for non-positive counts', () => {
		expect(selectBillTier(0)).toBeNull();
		expect(selectBillTier(-1)).toBeNull();
	});

	it('loose below 100 notes', () => {
		expect(selectBillTier(1)).toBe('loose');
		expect(selectBillTier(99)).toBe('loose');
	});

	it('strap from 100 to 999 notes', () => {
		expect(selectBillTier(100)).toBe('strap');
		expect(selectBillTier(999)).toBe('strap');
	});

	it('bundle from 1,000 to 99,999 notes', () => {
		expect(selectBillTier(1000)).toBe('bundle');
		expect(selectBillTier(99_999)).toBe('bundle');
	});

	it('cube from 100,000 to 9,999,999 notes', () => {
		expect(selectBillTier(100_000)).toBe('cube');
		expect(selectBillTier(9_999_999)).toBe('cube');
	});

	it('pallet at 10,000,000 notes and above', () => {
		expect(selectBillTier(10_000_000)).toBe('pallet');
		expect(selectBillTier(2_310_000_000_000)).toBe('pallet');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: FAIL — `selectBillTier` is not exported

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/billStack.ts

export type BillTier = 'loose' | 'strap' | 'bundle' | 'cube' | 'pallet';

/** Real cash-handling units: a strap bands 100 notes; a bundle is 10 straps. */
export const NOTES_PER_STRAP = 100;
export const NOTES_PER_BUNDLE = 1000;
/** Past this many notes, bundles are arranged into a roughly-cubic grid. */
export const CUBE_TIER_MIN_NOTES = 100_000;
/** Past this many notes, render a receding field of pallet-scale blocks. */
export const PALLET_TIER_MIN_NOTES = 10_000_000;

/** Which real-world cash-handling unit best represents this many notes. */
export function selectBillTier(noteCount: number): BillTier | null {
	if (!(noteCount > 0)) return null;
	if (noteCount < NOTES_PER_STRAP) return 'loose';
	if (noteCount < NOTES_PER_BUNDLE) return 'strap';
	if (noteCount < CUBE_TIER_MIN_NOTES) return 'bundle';
	if (noteCount < PALLET_TIER_MIN_NOTES) return 'cube';
	return 'pallet';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/billStack.ts tests/bill-stack.test.ts
git commit -m "feat: add bill tier selection"
```

---

## Task 3: Roughly-cubic bundle-grid solver

**Files:**
- Modify: `src/lib/billStack.ts`
- Test: `tests/bill-stack.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `interface CubicGrid { colsX: number; colsZ: number; layersY: number; extentXMm: number; extentZMm: number; extentYMm: number }`, `cubicGridDims(n: number, itemWidthMm: number, itemLengthMm: number, itemHeightMm: number): CubicGrid`

- [ ] **Step 1: Write the failing test**

```typescript
// append to tests/bill-stack.test.ts
import { cubicGridDims } from '../src/lib/billStack.js';

describe('cubicGridDims', () => {
	it('returns a zeroed grid for n <= 0', () => {
		const g = cubicGridDims(0, 1, 1, 1);
		expect(g).toEqual({ colsX: 0, colsZ: 0, layersY: 0, extentXMm: 0, extentZMm: 0, extentYMm: 0 });
	});

	it('unit cubes: perfect cube counts produce equal-side grids', () => {
		expect(cubicGridDims(8, 1, 1, 1)).toMatchObject({ colsX: 2, colsZ: 2, layersY: 2 });
		expect(cubicGridDims(27, 1, 1, 1)).toMatchObject({ colsX: 3, colsZ: 3, layersY: 3 });
		expect(cubicGridDims(1000, 1, 1, 1)).toMatchObject({ colsX: 10, colsZ: 10, layersY: 10 });
	});

	it('the grid always holds at least n items', () => {
		for (const n of [1, 5, 100, 110, 12345]) {
			const g = cubicGridDims(n, 66.294, 155.956, 109.22);
			expect(g.colsX * g.colsZ * g.layersY).toBeGreaterThanOrEqual(n);
		}
	});

	it('100 bundles (66.294 x 155.956 x 109.22 mm each) -> 7 x 3 x 5, roughly equal extents', () => {
		const g = cubicGridDims(100, 66.294, 155.956, 109.22);
		expect(g).toMatchObject({ colsX: 7, colsZ: 3, layersY: 5 });
		expect(g.colsX * g.colsZ * g.layersY).toBe(105);
		const extents = [g.extentXMm, g.extentZMm, g.extentYMm];
		const ratio = Math.max(...extents) / Math.min(...extents);
		expect(ratio).toBeLessThan(1.3); // "roughly cubic" — no side more than 30% off the others
	});

	it('110 bundles (the 1 BTC worked example) -> 8 x 3 x 5', () => {
		const g = cubicGridDims(110, 66.294, 155.956, 109.22);
		expect(g).toMatchObject({ colsX: 8, colsZ: 3, layersY: 5 });
		expect(g.colsX * g.colsZ * g.layersY).toBeGreaterThanOrEqual(110);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: FAIL — `cubicGridDims` is not exported

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/billStack.ts

export interface CubicGrid {
	colsX: number;
	colsZ: number;
	layersY: number;
	extentXMm: number;
	extentZMm: number;
	extentYMm: number;
}

/**
 * Arrange `n` identical items (each `itemWidthMm` x `itemLengthMm` x
 * `itemHeightMm`) into an integer 3D grid whose overall extents are as
 * close to equal as possible — the "roughly cubic stack" from the brief.
 * Closed-form target-extent solve (no brute-force search): if every axis
 * filled the same target extent `E`, the item count would be
 * `E^3 / (w*l*h)`; solve for `E`, round each axis's item count, then grow
 * whichever axis has the smallest extent until the grid holds >= n items.
 */
export function cubicGridDims(
	n: number,
	itemWidthMm: number,
	itemLengthMm: number,
	itemHeightMm: number
): CubicGrid {
	if (!(n > 0)) {
		return { colsX: 0, colsZ: 0, layersY: 0, extentXMm: 0, extentZMm: 0, extentYMm: 0 };
	}
	const targetExtent = Math.cbrt(n * itemWidthMm * itemLengthMm * itemHeightMm);
	let colsX = Math.max(1, Math.round(targetExtent / itemWidthMm));
	let colsZ = Math.max(1, Math.round(targetExtent / itemLengthMm));
	let layersY = Math.max(1, Math.round(targetExtent / itemHeightMm));

	while (colsX * colsZ * layersY < n) {
		const extents: [number, number, number] = [
			colsX * itemWidthMm,
			colsZ * itemLengthMm,
			layersY * itemHeightMm,
		];
		const minIdx = extents.indexOf(Math.min(...extents));
		if (minIdx === 0) colsX++;
		else if (minIdx === 1) colsZ++;
		else layersY++;
	}

	return {
		colsX,
		colsZ,
		layersY,
		extentXMm: colsX * itemWidthMm,
		extentZMm: colsZ * itemLengthMm,
		extentYMm: layersY * itemHeightMm,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/billStack.ts tests/bill-stack.test.ts
git commit -m "feat: add roughly-cubic bundle grid solver"
```

---

## Task 4: Human-scale height comparison ladder

**Files:**
- Modify: `src/lib/billStack.ts`
- Test: `tests/bill-stack.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `interface HeightComparison { label: string; metres: number }`, `HEIGHT_COMPARISONS: HeightComparison[]`, `nearestHeightComparison(heightM: number): { label: string; multiple: number } | null`

- [ ] **Step 1: Write the failing test**

```typescript
// append to tests/bill-stack.test.ts
import { nearestHeightComparison } from '../src/lib/billStack.js';

describe('nearestHeightComparison', () => {
	it('returns null below the shortest rung (an adult human, 1.7 m)', () => {
		expect(nearestHeightComparison(0.5)).toBeNull();
	});

	it('matches the shortest rung exactly at 1.7 m', () => {
		const c = nearestHeightComparison(1.7)!;
		expect(c.label).toBe('an adult human');
		expect(c.multiple).toBeCloseTo(1, 5);
	});

	it('1 BTC stack height (~12.01 m) -> ~5.9x a doorway', () => {
		const c = nearestHeightComparison(12.0142)!;
		expect(c.label).toBe('a doorway');
		expect(c.multiple).toBeCloseTo(5.918, 2);
	});

	it('100 BTC stack height (~1201.4 m) -> ~1.45x the Burj Khalifa', () => {
		const c = nearestHeightComparison(1201.42)!;
		expect(c.label).toBe('the Burj Khalifa');
		expect(c.multiple).toBeCloseTo(1.451, 2);
	});

	it('21M BTC stack height (~252,298 km) -> ~2523x the Karman line', () => {
		const c = nearestHeightComparison(252_298_200)!;
		expect(c.label).toBe('the Karman line (edge of space)');
		expect(c.multiple).toBeCloseTo(2522.98, 1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: FAIL — `nearestHeightComparison` is not exported

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/billStack.ts

export interface HeightComparison {
	label: string;
	metres: number;
}

/** Ascending by height — the ladder `nearestHeightComparison` walks. */
export const HEIGHT_COMPARISONS: HeightComparison[] = [
	{ label: 'an adult human', metres: 1.7 },
	{ label: 'a doorway', metres: 2.03 },
	{ label: 'the Statue of Liberty (pedestal to torch)', metres: 93 },
	{ label: 'the Eiffel Tower', metres: 330 },
	{ label: 'the Burj Khalifa', metres: 828 },
	{ label: 'Mount Everest', metres: 8849 },
	{ label: 'the Karman line (edge of space)', metres: 100_000 },
	{ label: 'the Moon', metres: 384_400_000 },
];

/**
 * The tallest ladder rung at or below `heightM`, and how many multiples of
 * it the stack stands. Returns null below the shortest rung — a fraction
 * of a doorway isn't a useful comparison, so the readout falls back to the
 * raw length in that case (see BillReadout).
 */
export function nearestHeightComparison(
	heightM: number
): { label: string; multiple: number } | null {
	if (heightM < HEIGHT_COMPARISONS[0].metres) return null;
	let best = HEIGHT_COMPARISONS[0];
	for (const c of HEIGHT_COMPARISONS) {
		if (c.metres <= heightM) best = c;
		else break;
	}
	return { label: best.label, multiple: heightM / best.metres };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bill-stack.test.ts`
Expected: PASS (22 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/billStack.ts tests/bill-stack.test.ts
git commit -m "feat: add human-scale height comparison ladder"
```

---

## Task 5: Note-count formatting

**Files:**
- Modify: `src/lib/format.ts`
- Test: `tests/format-note-count.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `formatNoteCount(count: number): string`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/format-note-count.test.ts
import { describe, it, expect } from 'vitest';
import { formatNoteCount } from '../src/lib/format.js';

describe('formatNoteCount', () => {
	it('zero and singular', () => {
		expect(formatNoteCount(0)).toBe('0 bills');
		expect(formatNoteCount(1)).toBe('1 bill');
	});

	it('grouped exact digits under 1 million', () => {
		expect(formatNoteCount(110)).toBe('110 bills');
		expect(formatNoteCount(110_000)).toBe('110,000 bills');
		expect(formatNoteCount(999_999)).toBe('999,999 bills');
	});

	it('abbreviated million/billion/trillion at and above 1 million', () => {
		expect(formatNoteCount(11_000_000)).toBe('11.00 million bills');
		expect(formatNoteCount(2_310_000_000_000)).toBe('2.31 trillion bills');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/format-note-count.test.ts`
Expected: FAIL — `formatNoteCount` is not exported

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/format.ts

// ── Note count formatting (Cash commodity) ─────────────────────

/**
 * Format a bill count. Exact grouped digits stay legible up to 999,999;
 * above that the M/B/T ladder matches formatUsd's convention elsewhere on
 * the site rather than printing an unreadable run of digits.
 */
export function formatNoteCount(count: number): string {
	if (count <= 0) return '0 bills';
	if (count === 1) return '1 bill';
	if (count >= 1_000_000_000_000) {
		return `${(count / 1_000_000_000_000).toFixed(2)} trillion bills`;
	}
	if (count >= 1_000_000_000) {
		return `${(count / 1_000_000_000).toFixed(2)} billion bills`;
	}
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(2)} million bills`;
	}
	return `${Math.round(count).toLocaleString('en-US')} bills`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/format-note-count.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format-note-count.test.ts
git commit -m "feat: add note-count formatter"
```

---

## Task 6: The Cash commodity entry

**Files:**
- Modify: `src/lib/commodities.ts`
- Test: `tests/cash-commodity.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `RenderStyle` gains `'bill_stack'`; `Commodity['unit']` gains `'note'`; `getCommodity('cash')` returns a `Commodity`; `LAUNCH_COMMODITIES` has 5 entries, last one `id: 'cash'`, `pageOrder: 5`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cash-commodity.test.ts
import { describe, it, expect } from 'vitest';
import { getCommodity, LAUNCH_COMMODITIES, ALL_COMMODITIES } from '../src/lib/commodities.js';

describe('cash commodity', () => {
	it('is registered with the expected shape', () => {
		const cash = getCommodity('cash');
		expect(cash).toBeDefined();
		expect(cash?.displayName).toBe('Cash');
		expect(cash?.renderStyle).toBe('bill_stack');
		expect(cash?.unit).toBe('note');
		expect(cash?.unitMassGrams).toBe(1);
		expect(cash?.mvpLaunch).toBe(true);
		expect(cash?.pageOrder).toBe(5);
		expect(cash?.dataQuality).toBe('live');
	});

	it('is the 5th launch commodity, after cocaine', () => {
		expect(LAUNCH_COMMODITIES).toHaveLength(5);
		expect(LAUNCH_COMMODITIES[4].id).toBe('cash');
		expect(LAUNCH_COMMODITIES[3].id).toBe('cocaine');
	});

	it('is present in the full catalogue', () => {
		expect(ALL_COMMODITIES.some((c) => c.id === 'cash')).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cash-commodity.test.ts`
Expected: FAIL — `getCommodity('cash')` returns `undefined`, `LAUNCH_COMMODITIES` has 4 entries

- [ ] **Step 3: Write minimal implementation**

In `src/lib/commodities.ts`, extend the `RenderStyle` union (around line 15):

```typescript
export type RenderStyle =
	| 'cube' // gold, silver, Pu-238 — live WebGL cube + Shiba
	| 'still_with_readout' // cocaine — inline-SVG brick stack + pricing readout
	| 'bill_stack' // cash — live WebGL dollar-bill stack + pricing readout
	| 'progression' // legacy, unused at MVP
	| 'vessel' // legacy, unused at MVP
	| 'bulk'; // legacy, unused at MVP
```

Extend the `unit` union on `Commodity` (around line 91):

```typescript
	unit: 'troy_oz' | 'lb' | 'barrel' | 'gram' | 'kg' | 'pellet' | 'note';
```

Update the top-of-file launch-order doc comment (around line 6-9):

```typescript
 * Page render loop iterates `mvpLaunch === true` commodities sorted ascending
 * by `pageOrder`. Locked launch order (2026-07-11 five-commodity pivot):
 *   1. gold
 *   2. silver
 *   3. pu238
 *   4. cocaine
 *   5. cash
```

Add the commodity definition after `cocaine` (around line 258, before the `copper` deferred entry):

```typescript
const cash: Commodity = {
	id: 'cash',
	displayName: 'Cash',
	mvpLaunch: true,
	pageOrder: 5,
	renderStyle: 'bill_stack',
	unit: 'note',
	unitMassGrams: 1,
	sourceId: 'cash',
	sourceName:
		'U.S. Bureau of Engraving and Printing (note dimensions) — exact by construction, not a market price',
	dataQuality: 'live', // depends only on the live BTC/USD price already in prices.json
	priceField: 'usd_note', // sentinel — never looked up, see getCommodityPrice's cash special-case
	facts: [],
	expectedHeightPx: { mobile: 1010, desktop: 1130 },
};
```

Add `cash` to `ALL_COMMODITIES` (after `cocaine`):

```typescript
export const ALL_COMMODITIES: Commodity[] = [
	gold,
	silver,
	pu238,
	cocaine,
	cash,
	copper,
	oil_brent,
	uranium_fuel_pellet,
	platinum,
	coffee,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cash-commodity.test.ts`
Expected: PASS (3 tests). Also run `npx vitest run` (full suite) to confirm nothing else broke from the `RenderStyle`/`unit` union changes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/commodities.ts tests/cash-commodity.test.ts
git commit -m "feat: register cash as the 5th launch commodity"
```

---

## Task 7: Exact pricing (1 note = $1)

**Files:**
- Modify: `src/lib/prices.ts`
- Test: `tests/cash-pricing.test.ts`

**Interfaces:**
- Consumes: `getCommodity('cash')` from Task 6
- Produces: `getCommodityPrice(cashCommodity, dayPrices)` returns `1`; `computeCommodityAmount(btcAmount, cashCommodity, dayPrices)` returns `noteCount`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cash-pricing.test.ts
import { describe, it, expect } from 'vitest';
import { getCommodityPrice, computeCommodityAmount, type DayPrices } from '../src/lib/prices.js';
import { getCommodity } from '../src/lib/commodities.js';

const cash = getCommodity('cash')!;
const dayPrices: DayPrices = { btc: 110_000 } as DayPrices;

describe('cash pricing', () => {
	it('one note is worth exactly one dollar', () => {
		expect(getCommodityPrice(cash, dayPrices)).toBe(1);
	});

	it('note count = BTC amount x live BTC/USD price', () => {
		expect(computeCommodityAmount(0.001, cash, dayPrices)).toBeCloseTo(110, 6);
		expect(computeCommodityAmount(1, cash, dayPrices)).toBeCloseTo(110_000, 6);
		expect(computeCommodityAmount(100, cash, dayPrices)).toBeCloseTo(11_000_000, 3);
	});

	it('returns null when there is no BTC price for the day', () => {
		expect(computeCommodityAmount(1, cash, undefined)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cash-pricing.test.ts`
Expected: FAIL — `getCommodityPrice` falls through to the `dayPrices[commodity.priceField]` branch, which is `undefined` for the `'usd_note'` sentinel field, so `getCommodityPrice` returns `null` and `computeCommodityAmount` returns `null` instead of `110`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/prices.ts`, `getCommodityPrice`, add the cash special-case as the very first branch (before the existing `dataQuality === 'illustrative'` check):

```typescript
export function getCommodityPrice(
	commodity: Commodity,
	dayPrices: DayPrices | undefined
): number | null {
	// Cash: one $1 note is worth exactly one dollar, always — not a market
	// price, so it bypasses both the live-feed lookup and the illustrative
	// pricing table below.
	if (commodity.id === 'cash') {
		return 1;
	}

	if (commodity.dataQuality === 'illustrative') {
		// ... existing cocaine/illustrative branch unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cash-pricing.test.ts`
Expected: PASS (3 tests). Also run `npx vitest run` (full suite) to confirm the cocaine/illustrative branches are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prices.ts tests/cash-pricing.test.ts
git commit -m "feat: price cash notes exactly at \$1, bypassing market data"
```

---

## Task 8: Asset pipeline — strip the watermarked texture, compress the mesh

**Files:**
- Create: `scripts/compress-bill.ts`
- Modify: `package.json` (add `compress-bill` script)

**Interfaces:**
- Consumes: `assets/blender/one_dollar_bill.glb` (already on disk)
- Produces: `static/models/references/one_dollar_bill/bill.glb` — geometry-only (zero embedded textures), meshopt-compressed, ≤100 KB

- [ ] **Step 1: Write the script**

```typescript
// scripts/compress-bill.ts
/**
 * compress-bill.ts — strip the watermarked stock-photo texture baked into
 * the source one_dollar_bill.glb and compress the remaining geometry-only
 * mesh. The bill's visible face is assigned at runtime by
 * src/lib/scene/billMaterials.ts (a procedural CanvasTexture) — the shipped
 * glb never carries the original photo, so the watermark can never reach
 * the browser. See docs/handoff/14-cash.md ("3D model") for the full story.
 *
 * Source: assets/blender/one_dollar_bill.glb
 *   · single mesh, 24 verts / 12 tris, thin box, doubleSided
 *   · baseColorTexture: 1024x1024 JPEG, watermarked stock photo — DROPPED
 *   · modeled at exactly 2x true scale (a Sketchfab unit-scale artifact) —
 *     NOT corrected here; the runtime loader normalizes scale by measured
 *     bounding box (see src/lib/scene/loadNormalizedModel.ts), the same
 *     technique already used for the Shiba model.
 *
 * Output: static/models/references/one_dollar_bill/bill.glb
 */

import { NodeIO } from '@gltf-transform/core';
import { execFileSync } from 'node:child_process';
import { statSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC = path.join(ROOT, 'assets/blender/one_dollar_bill.glb');
const STRIPPED = path.join(ROOT, 'static/models/references/one_dollar_bill/_stripped.glb');
const OUT = path.join(ROOT, 'static/models/references/one_dollar_bill/bill.glb');
const CLI = path.join(ROOT, 'node_modules/.bin/gltf-transform');

const TARGET_BYTES = 100 * 1024; // 100 KB — geometry-only, no animation, no texture

function fail(message: string): never {
	console.error(`\n✗ compress-bill: ${message}\n`);
	process.exit(1);
}

async function stripTexture(): Promise<void> {
	const io = new NodeIO();
	const doc = await io.read(SRC);
	const textures = doc.getRoot().listTextures();
	if (textures.length === 0) {
		fail('source has no textures to strip — check SRC still points at the Sketchfab export');
	}
	for (const mat of doc.getRoot().listMaterials()) {
		mat.setBaseColorTexture(null);
	}
	for (const tex of textures) tex.dispose();
	mkdirSync(path.dirname(STRIPPED), { recursive: true });
	await io.write(STRIPPED, doc);
}

async function verify(): Promise<void> {
	const outBytes = statSync(OUT).size;
	const sizeKb = (outBytes / 1024).toFixed(1);
	if (outBytes > TARGET_BYTES) {
		fail(`output is ${sizeKb} KB, over the ${TARGET_BYTES / 1024} KB budget.`);
	}

	const io = new NodeIO();
	const doc = await io.read(OUT);
	const textures = doc.getRoot().listTextures();
	if (textures.length > 0) {
		fail(
			`output still has ${textures.length} texture(s) — the watermarked source image was not fully stripped`
		);
	}
	const meshes = doc.getRoot().listMeshes();
	if (meshes.length === 0) {
		fail('output has no meshes — the geometry was lost somewhere in the pipeline');
	}

	console.log(`\n✓ ${path.relative(ROOT, OUT)} — ${sizeKb} KB (≤ ${TARGET_BYTES / 1024} KB budget)`);
	console.log('✓ zero embedded textures (watermarked source image stripped)');
	console.log(`✓ ${meshes.length} mesh(es) present\n`);
}

async function main(): Promise<void> {
	if (!existsSync(SRC)) fail(`source model not found at ${SRC}`);
	if (!existsSync(CLI)) fail('gltf-transform CLI not found — run `npm install` first');

	await stripTexture();
	if (!existsSync(STRIPPED)) fail('texture-strip step ran but produced no intermediate file');

	execFileSync(CLI, ['optimize', STRIPPED, OUT, '--compress', 'meshopt', '--simplify', 'false'], {
		stdio: 'inherit',
		cwd: ROOT,
	});
	if (!existsSync(OUT)) fail('optimize ran but produced no output file');

	await verify();
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
```

- [ ] **Step 2: Run it and verify the output**

Run: `npx tsx scripts/compress-bill.ts`
Expected output ends with:
```
✓ static/models/references/one_dollar_bill/bill.glb — 2.4 KB (≤ 100 KB budget)
✓ zero embedded textures (watermarked source image stripped)
✓ 1 mesh(es) present
```
(Verified during design research: the stripped+optimized file lands at ~2.4 KB, well inside budget.)

- [ ] **Step 3: Add the npm script**

In `package.json`, add to `"scripts"` (alongside the existing `compress-shiba`):

```json
    "compress-bill": "tsx scripts/compress-bill.ts",
```

- [ ] **Step 4: Commit**

```bash
git add scripts/compress-bill.ts package.json static/models/references/one_dollar_bill/bill.glb
git commit -m "feat: add bill asset pipeline, strip watermarked source texture"
```

---

## Task 9: Shared GLB normalization loader (extracted from LiveStage's Shiba loader)

**Files:**
- Create: `src/lib/scene/loadNormalizedModel.ts`
- Modify: `src/lib/scene/LiveStage.svelte:347-397` (refactor `loadDog` to use the new util — behavior must not change)

**Interfaces:**
- Consumes: `three` module namespace, a `GLTFLoader` constructor, a `MeshoptDecoder` instance (all already dynamic-imported by `LiveStage.svelte`)
- Produces: `loadNormalizedModel(three, GLTFLoaderCtor, meshoptDecoder, url, targetSizeM, axis, onLoad, onError?): void`

- [ ] **Step 1: Write the util**

```typescript
// src/lib/scene/loadNormalizedModel.ts
/**
 * Load a .glb and uniformly scale it so its bounding-box size along `axis`
 * equals `targetSizeM`, then sit it on the ground (min.y === 0). Every
 * reference/prop model in the scene (Shiba, dollar bill) uses this so a
 * model's real-world size comes from one measured constant here, never a
 * guess baked into the asset's own export scale — the Shiba's glb and the
 * bill's glb both ship at whatever scale their source tool exported them
 * at (the bill happens to be exactly 2x true size, a Sketchfab artifact);
 * this function is what makes that not matter.
 */
import type * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadNormalizedModel(
	three: typeof THREE,
	GLTFLoaderCtor: typeof GLTFLoader,
	meshoptDecoder: Parameters<GLTFLoader['setMeshoptDecoder']>[0],
	url: string,
	targetSizeM: number,
	axis: 'x' | 'y' | 'z',
	onLoad: (object: THREE.Object3D, animations: THREE.AnimationClip[]) => void,
	onError?: () => void
): void {
	const loader = new GLTFLoaderCtor();
	loader.setMeshoptDecoder(meshoptDecoder);
	loader.load(
		url,
		(gltf) => {
			const object = gltf.scene;
			const box = new three.Box3().setFromObject(object);
			const size = box.getSize(new three.Vector3());
			const rawSize = axis === 'x' ? size.x : axis === 'y' ? size.y : size.z;
			if (rawSize > 0) object.scale.setScalar(targetSizeM / rawSize);
			const groundedBox = new three.Box3().setFromObject(object);
			object.position.y -= groundedBox.min.y;
			onLoad(object, gltf.animations ?? []);
		},
		undefined,
		() => onError?.()
	);
}
```

- [ ] **Step 2: Refactor LiveStage's loadDog to use it**

In `src/lib/scene/LiveStage.svelte`, add the import near the top (with the other type-only/erased imports, around line 24):

```typescript
	import { loadNormalizedModel } from './loadNormalizedModel.js';
```

Replace the body of `loadDog` (currently lines 347-397) with:

```typescript
	function loadDog(
		three: typeof THREE,
		GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader,
		MeshoptDecoder: typeof import('three/addons/libs/meshopt_decoder.module.js').MeshoptDecoder
	): void {
		loadNormalizedModel(
			three,
			GLTFLoader,
			MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			M!.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene || !M) return;
				dog = object;
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
				});
				scene.add(dog);

				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					// Clips: play_dead, rollover, shake, sitting, standing. sitting is
					// the resting idle; the first three are easter-egg tricks. Select
					// the idle by NAME — animations[0] is play_dead (the dog dies; a
					// shipped prototype bug we must NOT regress).
					const idleClip =
						animations.find((c) => c.name.includes('sitting')) ??
						animations[animations.length - 1];
					idleAction = mixer.clipAction(idleClip);
					trickClips = animations.filter((c) => /play_dead|rollover|shake/.test(c.name));
					if (!prefersReduced) idleAction.play();
					mixer.addEventListener('finished', () => {
						trickPlaying = false;
						idleAction?.reset().fadeIn(0.3).play();
					});
					if (new URLSearchParams(location.search).get('easter') === 'doge') {
						setTimeout(playTrick, 800);
					}
				}
				update(true);
			},
			() => {
				/* Model failed — scene continues without the dog; the poster keeps a
				   Shiba anyway, so this degrades gracefully. */
			}
		);
	}
```

- [ ] **Step 3: Manually verify the refactor didn't change behavior**

Run: `npm run dev`, open the homepage, wait for the WebGL stage to hydrate (click anywhere or wait ~3s for idle-load), confirm the Shiba still loads, idles, and the play-dead/rollover/shake tricks still fire on hover/tap (or via `?easter=doge` in the URL). This is the same manual check the Shiba build already required — there is no automated test for the 3D scene's visual behavior in this codebase (`tests/scene-maths.test.ts` covers the pure camera maths only, not the WebGL rendering itself).

- [ ] **Step 4: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (all existing tests, including `tests/scene-maths.test.ts` — untouched by this refactor)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scene/loadNormalizedModel.ts src/lib/scene/LiveStage.svelte
git commit -m "refactor: extract shared bbox-normalized GLB loader from LiveStage"
```

---

## Task 10: Procedural bill textures

**Files:**
- Create: `src/lib/scene/billMaterials.ts`

**Interfaces:**
- Consumes: nothing new (client-only, mirrors `materials.ts`'s `makeRoughnessMap` pattern — touches `document`, so only ever imported after hydration)
- Produces: `makeBillFaceTexture(): THREE.CanvasTexture`, `makeBillEdgeTexture(): THREE.CanvasTexture`, `makeBillMaterials(faceTexture, edgeTexture): { face: THREE.MeshStandardMaterial; edge: THREE.MeshStandardMaterial }`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/scene/billMaterials.ts
/**
 * Procedural, stylized dollar-bill textures — deliberately NOT a
 * reproduction of genuine Federal Reserve Note artwork (see
 * docs/handoff/14-cash.md, "3D model": the source glb's baked-in texture
 * was a watermarked stock photo of a real note and was stripped in
 * scripts/compress-bill.ts). Canvas-drawn at runtime, same technique as
 * materials.ts's makeRoughnessMap — client-only, imported after hydration.
 */
import * as THREE from 'three';

const PAPER = '#e9e4d3';
const INK = '#2f5d3a';
const MEDALLION_FILL = '#cfc9b0';
const SILHOUETTE = '#8f8a72';

/** The bill's face — top/bottom of a bundle or literal-stack block. */
export function makeBillFaceTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 435; // matches the 155.956:66.294 (~2.353:1) bill aspect ratio
	const ctx = canvas.getContext('2d')!;
	const W = canvas.width;
	const H = canvas.height;

	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, W, H);

	ctx.strokeStyle = INK;
	ctx.lineWidth = 6;
	ctx.strokeRect(14, 14, W - 28, H - 28);
	ctx.lineWidth = 2;
	ctx.strokeRect(24, 24, W - 48, H - 48);

	ctx.fillStyle = INK;
	ctx.font = 'bold 46px Georgia, serif';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';
	ctx.fillText('$1', 40, 70);
	ctx.textAlign = 'right';
	ctx.fillText('$1', W - 40, 70);
	ctx.textAlign = 'left';
	ctx.fillText('$1', 40, H - 60);
	ctx.textAlign = 'right';
	ctx.fillText('$1', W - 40, H - 60);

	// Abstract portrait medallion — a plain circle + simple silhouette, not
	// a likeness of any real person or engraving.
	ctx.beginPath();
	ctx.arc(W / 2, H / 2, 90, 0, Math.PI * 2);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.fillStyle = MEDALLION_FILL;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(W / 2, H / 2 - 10, 34, 0, Math.PI * 2); // head
	ctx.fillStyle = SILHOUETTE;
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(W / 2, H / 2 + 55, 46, 34, 0, Math.PI, 0); // shoulders
	ctx.fill();

	ctx.fillStyle = INK;
	ctx.font = 'bold 30px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText('ONE', W / 2, 40);
	ctx.font = '16px Georgia, serif';
	ctx.fillText('UNITED STATES', W / 2, H - 28);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * The side-face pattern for a coalesced bill-stack block. This is a single
 * repeat unit; the caller sets `texture.repeat.y` to the true note count
 * the block represents, so the stripe density on screen is physically
 * honest (one repeat = one note's edge) rather than a decorative pattern —
 * the "precise thickness" requirement made visible.
 */
export function makeBillEdgeTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#efe9d8';
	ctx.fillRect(0, 0, 32, 64);
	ctx.fillStyle = '#c9c2a4';
	ctx.fillRect(0, 0, 32, 6); // one note's edge line, top of the repeat unit

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	return texture;
}

export interface BillMaterials {
	face: THREE.MeshStandardMaterial;
	edge: THREE.MeshStandardMaterial;
}

/** Matte paper materials — bills are not metal, no envMap/metalness needed. */
export function makeBillMaterials(
	faceTexture: THREE.CanvasTexture,
	edgeTexture: THREE.CanvasTexture
): BillMaterials {
	return {
		face: new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.85, metalness: 0 }),
		edge: new THREE.MeshStandardMaterial({ map: edgeTexture, roughness: 0.9, metalness: 0 }),
	};
}
```

- [ ] **Step 2: Manually verify it renders**

This module has no pure-logic surface worth unit-testing in isolation (it's Canvas 2D drawing calls, and jsdom's canvas 2D context support is unreliable in this repo's Vitest setup — no other canvas-drawing module here, e.g. `materials.ts`, has a test file either, consistent with that). Verification happens visually in Task 11, once `BillStage.svelte` actually applies these materials to a mesh in the browser.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scene/billMaterials.ts
git commit -m "feat: add procedural stylized bill textures"
```

---

## Task 11: BillStage scene bootstrap — one bill renders

**Files:**
- Create: `src/lib/scene/BillStage.svelte`

**Interfaces:**
- Consumes: `Commodity` type (`$lib/commodities.js`), `loadNormalizedModel` (Task 9), `makeBillFaceTexture`/`makeBillEdgeTexture`/`makeBillMaterials` (Task 10), `BILL_LENGTH_MM`/`BILL_WIDTH_MM` (Task 1), `cameraTransform`/`FOV_DEG` from `./maths.js` (existing, unchanged)
- Produces: a mountable `<BillStage noteCount={number} />` Svelte component; exports (for Task 12/13/14 to extend) an internal `bakedBillGeometry: THREE.BufferGeometry | null` obtained once at hydrate

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/scene/BillStage.svelte -->
<script lang="ts">
	/**
	 * BillStage — the Cash tab's live WebGL stage. Sibling to LiveStage.svelte
	 * (not an extension of it, same separation as CocaineBrickStack being
	 * wholly separate from CubeRenderer) because the mesh strategy is
	 * fundamentally different: instanced real bill geometry + coalesced
	 * textured blocks, not a single scaled cube.
	 *
	 * This task (11) only proves the pipeline: load the bill glb, normalize
	 * its scale, bake its transform into a reusable geometry, and render one
	 * bill so the load->normalize->material chain is verified working.
	 * Tiered/literal instancing land in Tasks 12-13; the click/keyboard
	 * toggle lands in Task 14.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';

	let { noteCount = 0 }: { noteCount?: number } = $props();

	const BG = 0x18181b;
	const BILL_MODEL_URL = '/models/references/one_dollar_bill/bill.glb';

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasActive = $state(false);

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let key: THREE.DirectionalLight | null = null;
	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;

	let bakedBillGeometry: THREE.BufferGeometry | null = null;
	let billMats: { face: THREE.MeshStandardMaterial; edge: THREE.MeshStandardMaterial } | null =
		null;
	let previewMesh: THREE.Mesh | null = null;

	let width = 0;
	let height = 0;
	let destroyed = false;
	let rafId = 0;
	let resizeObs: ResizeObserver | null = null;

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	/** Flatten a loaded (already scale-normalized) model's first mesh into a
	 *  standalone geometry in true real-world millimetres — the standard
	 *  three.js technique for turning a loaded scene graph into something an
	 *  InstancedMesh can reuse without carrying a wrapper transform. */
	function extractBakedGeometry(three: typeof THREE, root: THREE.Object3D): THREE.BufferGeometry | null {
		root.updateMatrixWorld(true);
		let found: THREE.BufferGeometry | null = null;
		root.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (!found && mesh.isMesh && mesh.geometry) {
				const geom = mesh.geometry.clone();
				geom.applyMatrix4(mesh.matrixWorld);
				found = geom;
			}
		});
		return found;
	}

	async function hydrate(): Promise<void> {
		if (destroyed || canvasActive || !containerEl) return;

		const [three, gltfMod, moMod, billMaterialsMod, billStackMod] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./billMaterials.js'),
			import('../billStack.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		camera = new three.PerspectiveCamera(35, width / height, 1e-4, 5000);

		key = new three.DirectionalLight(0xfff2dd, 2.2);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key);
		scene.add(new three.AmbientLight(0x404048, 0.4));

		const ground = new three.Mesh(
			new three.CircleGeometry(4000, 64).rotateX(-Math.PI / 2),
			new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 })
		);
		ground.receiveShadow = true;
		scene.add(ground);

		const face = billMaterialsMod.makeBillFaceTexture();
		const edge = billMaterialsMod.makeBillEdgeTexture();
		billMats = billMaterialsMod.makeBillMaterials(face, edge);

		camPos = new three.Vector3(0.3, 0.15, 0.4);
		camAim = new three.Vector3(0, 0.02, 0);
		camera.position.copy(camPos);
		camera.lookAt(camAim);

		loadNormalizedModel(
			three,
			gltfMod.GLTFLoader,
			moMod.MeshoptDecoder,
			BILL_MODEL_URL,
			billStackMod.BILL_LENGTH_MM / 1000, // metres
			'x',
			(object) => {
				if (destroyed || !scene || !billMats) return;
				bakedBillGeometry = extractBakedGeometry(three, object);
				if (bakedBillGeometry && billMats) {
					previewMesh = new three.Mesh(bakedBillGeometry, billMats.face);
					previewMesh.castShadow = true;
					previewMesh.position.y = billStackMod.BILL_THICKNESS_MM / 1000 / 2;
					scene.add(previewMesh);
					render();
				}
			},
			() => {
				/* Model failed to load — the poster (BillRenderer, Task 15) covers
				   this state; the WebGL canvas just stays empty. */
			}
		);

		canvasActive = true;
		render();

		resizeObs = new ResizeObserver(() => onResize());
		resizeObs.observe(containerEl);
	}

	function render(): void {
		if (!renderer || !scene || !camera) return;
		renderer.render(scene, camera);
	}

	function onResize(): void {
		if (!containerEl || !renderer || !camera) return;
		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		render();
	}

	function teardown(): void {
		if (resizeObs) resizeObs.disconnect();
		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}
		renderer = scene = camera = key = null;
	}

	onMount(() => {
		if (!browser) return;
		if (!hasWebGL()) return;
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});
</script>

<div class="bill-stage" bind:this={containerEl}></div>

<style>
	.bill-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.bill-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
```

- [ ] **Step 2: Smoke-mount it and verify manually**

Temporarily add `<BillStage noteCount={110000} />` to any existing route (e.g. paste it at the top of `src/routes/+page.svelte`'s markup) or create a scratch route `src/routes/dev-bill-test/+page.svelte` that just renders `<BillStage />`. Run `npm run dev`, open the page, confirm: a single stylized green bill renders in the 3D scene, lit, casting a shadow, no console errors. Remove the scratch route/temporary markup before moving on — this step is throwaway verification, not part of the shipped feature.

Run: `npx vitest run` — expect PASS (this task adds no new pure-logic tests; the whole point of Task 11 is the WebGL wiring, verified manually per the codebase's existing convention for 3D scene code).

- [ ] **Step 3: Commit**

```bash
git add src/lib/scene/BillStage.svelte
git commit -m "feat: add BillStage WebGL scene bootstrap, single bill renders"
```

---

## Task 12: Tiered-mode rendering

**Files:**
- Modify: `src/lib/scene/BillStage.svelte`

**Interfaces:**
- Consumes: `selectBillTier`, `cubicGridDims`, `NOTES_PER_BUNDLE`, `BILL_WIDTH_MM`, `BILL_LENGTH_MM`, `BILL_THICKNESS_MM` (Tasks 1-3), `bakedBillGeometry`/`billMats` (Task 11)
- Produces: `noteCount` prop drives a rendered tier: `loose`/`strap` (<1,000 notes) as individually-instanced bills; `bundle`/`cube` (1,000-9,999,999 notes) as coalesced textured blocks arranged via `cubicGridDims`; `pallet` (>=10,000,000) as a capped receding field of pallet-scale blocks

Design simplification (stated explicitly, not hidden): every tier's *numbers* (count, mass, height) are always exactly correct via `billStack.ts`, driving the readout regardless of which visual branch below renders. The visual distinction between `loose` and `strap` is cosmetic polish (banded/shrink-wrap decals) explicitly deferred — see "Follow-ups" at the end of this plan; both render as individually-instanced bills here. This keeps the render code to three branches instead of five while every tier still reports its correct real-world label in the readout (Task 16).

- [ ] **Step 1: Add the tiered-render function**

Add to the `<script>` block of `src/lib/scene/BillStage.svelte`, after `extractBakedGeometry`:

```typescript
	const BUNDLE_HEIGHT_MM = 1000 * 0.10922; // NOTES_PER_BUNDLE x BILL_THICKNESS_MM, see billStack.ts
	const PALLET_BUNDLES = 1000; // 1,000 bundles/pallet = 1,000,000 notes/pallet (10x10x10 grid)
	const PALLET_RENDER_CAP = 60; // receding field caps here; the readout's note-count carries the rest

	let tierGroup: THREE.Group | null = null;

	function clearTierGroup(three: typeof THREE): void {
		if (!scene || !tierGroup) return;
		scene.remove(tierGroup);
		tierGroup.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (mesh.isMesh) mesh.geometry?.dispose();
		});
		tierGroup = null;
	}

	function renderTiered(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		if (previewMesh) {
			scene.remove(previewMesh);
			previewMesh = null;
		}
		tierGroup = new three.Group();

		const tier = billStackMod.selectBillTier(count);
		if (!tier) {
			scene.add(tierGroup);
			return 0;
		}

		const widthM = billStackMod.BILL_WIDTH_MM / 1000;
		const lengthM = billStackMod.BILL_LENGTH_MM / 1000;
		const thicknessM = billStackMod.BILL_THICKNESS_MM / 1000;

		if (tier === 'loose' || tier === 'strap') {
			// Individually-instanced real bill geometry — cheap up to ~1,000
			// instances of a 24-vertex mesh, and this is exactly the range
			// where the eye can still resolve individual bills.
			const instanced = new three.InstancedMesh(bakedBillGeometry, billMats.face, count);
			instanced.castShadow = true;
			const m = new three.Matrix4();
			for (let i = 0; i < count; i++) {
				const jitterX = (Math.random() - 0.5) * widthM * 0.02;
				const jitterZ = (Math.random() - 0.5) * lengthM * 0.02;
				const jitterRotY = (Math.random() - 0.5) * 0.05;
				m.makeRotationY(jitterRotY);
				m.setPosition(jitterX, thicknessM * (i + 0.5), jitterZ);
				instanced.setMatrixAt(i, m);
			}
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
			scene.add(tierGroup);
			return count * thicknessM; // dominant extent, metres
		}

		// bundle / cube / pallet: coalesced textured blocks, one per bundle
		// of NOTES_PER_BUNDLE notes, arranged via cubicGridDims.
		const bundleGeom = new three.BoxGeometry(widthM, BUNDLE_HEIGHT_MM / 1000, lengthM);
		const edgeMat = billMats.edge.clone();
		edgeMat.map = edgeMat.map!.clone();
		edgeMat.map.repeat.set(1, billStackMod.NOTES_PER_BUNDLE);
		edgeMat.map.needsUpdate = true;
		const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat]; // BoxGeometry face order: +x -x +y -y +z -z

		if (tier === 'bundle' || tier === 'cube') {
			const bundleCount = Math.ceil(count / billStackMod.NOTES_PER_BUNDLE);
			const grid = billStackMod.cubicGridDims(
				bundleCount,
				billStackMod.BILL_WIDTH_MM,
				billStackMod.BILL_LENGTH_MM,
				BUNDLE_HEIGHT_MM
			);
			const instanced = new three.InstancedMesh(bundleGeom, blockMats, grid.colsX * grid.colsZ * grid.layersY);
			instanced.castShadow = true;
			const m = new three.Matrix4();
			let i = 0;
			for (let x = 0; x < grid.colsX; x++) {
				for (let y = 0; y < grid.layersY; y++) {
					for (let z = 0; z < grid.colsZ; z++) {
						if (i >= bundleCount) break;
						m.setPosition(
							(x - (grid.colsX - 1) / 2) * widthM,
							y * (BUNDLE_HEIGHT_MM / 1000) + BUNDLE_HEIGHT_MM / 1000 / 2,
							(z - (grid.colsZ - 1) / 2) * lengthM
						);
						instanced.setMatrixAt(i, m);
						i++;
					}
				}
			}
			instanced.count = i;
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
			scene.add(tierGroup);
			return Math.max(grid.extentXMm, grid.extentYMm, grid.extentZMm) / 1000;
		}

		// pallet: a receding field of pallet-scale blocks (10x10x10 bundles
		// each), capped for renderability — the readout's note count carries
		// the true magnitude past the cap, same principle as Cocaine's
		// `production` tier.
		const palletExtentMm = 10 * Math.max(billStackMod.BILL_WIDTH_MM, billStackMod.BILL_LENGTH_MM, BUNDLE_HEIGHT_MM);
		const palletGeom = new three.BoxGeometry(
			(10 * billStackMod.BILL_WIDTH_MM) / 1000,
			(10 * BUNDLE_HEIGHT_MM) / 1000,
			(10 * billStackMod.BILL_LENGTH_MM) / 1000
		);
		const totalPallets = Math.ceil(count / (billStackMod.NOTES_PER_BUNDLE * PALLET_BUNDLES));
		const renderedPallets = Math.min(totalPallets, PALLET_RENDER_CAP);
		const grid = billStackMod.cubicGridDims(renderedPallets, palletExtentMm, palletExtentMm, palletExtentMm);
		const instanced = new three.InstancedMesh(palletGeom, blockMats, grid.colsX * grid.colsZ * grid.layersY);
		instanced.castShadow = true;
		const m = new three.Matrix4();
		let i = 0;
		for (let x = 0; x < grid.colsX; x++) {
			for (let y = 0; y < grid.layersY; y++) {
				for (let z = 0; z < grid.colsZ; z++) {
					if (i >= renderedPallets) break;
					m.setPosition(
						(x - (grid.colsX - 1) / 2) * (palletExtentMm / 1000),
						y * (palletExtentMm / 1000) + palletExtentMm / 1000 / 2,
						(z - (grid.colsZ - 1) / 2) * (palletExtentMm / 1000)
					);
					instanced.setMatrixAt(i, m);
					i++;
				}
			}
		}
		instanced.count = i;
		instanced.instanceMatrix.needsUpdate = true;
		tierGroup.add(instanced);
		scene.add(tierGroup);
		return Math.max(grid.extentXMm, grid.extentYMm, grid.extentZMm) / 1000;
	}
```

- [ ] **Step 2: Wire it to the `noteCount` prop**

Add a reactive effect near the bottom of the `<script>` block (after `onMount`):

```typescript
	$effect(() => {
		const count = noteCount;
		if (!canvasActive || !T || !bakedBillGeometry) return;
		import('../billStack.js').then((billStackMod) => {
			if (destroyed || !T) return;
			renderTiered(T, billStackMod, count);
			render();
		});
	});
```

- [ ] **Step 3: Manually verify at the canonical worked positions**

Using the same scratch-mount approach as Task 11 Step 2, render `<BillStage noteCount={n} />` for `n` in `[50, 500, 50000, 5000000, 50000000]` (one per tier) and confirm: loose/strap show individually-scattered bills; bundle/cube show a grid of green-topped blocks, roughly cube-shaped at the `cube` tier; pallet shows a capped receding field. No console errors at any value.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scene/BillStage.svelte
git commit -m "feat: render tiered bill-stack view (loose/strap/bundle/cube/pallet)"
```

---

## Task 13: Literal-mode rendering

**Files:**
- Modify: `src/lib/scene/BillStage.svelte`

**Interfaces:**
- Consumes: same as Task 12, plus `stackHeightMm` (Task 1)
- Produces: `viewMode` prop (`'tiered' | 'literal'`, default `'tiered'`); in `'literal'` mode, always renders one column at true height regardless of tier

- [ ] **Step 1: Add the literal-render function**

Add to the `<script>` block, after `renderTiered`:

```typescript
	const LITERAL_INSTANCE_CAP = 2000; // individually-instanced bills at the base of the column

	function renderLiteral(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		if (previewMesh) {
			scene.remove(previewMesh);
			previewMesh = null;
		}
		tierGroup = new three.Group();

		const widthM = billStackMod.BILL_WIDTH_MM / 1000;
		const lengthM = billStackMod.BILL_LENGTH_MM / 1000;
		const thicknessM = billStackMod.BILL_THICKNESS_MM / 1000;
		const totalHeightM = billStackMod.stackHeightMm(count) / 1000;

		const instancedCount = Math.min(count, LITERAL_INSTANCE_CAP);
		if (instancedCount > 0) {
			const instanced = new three.InstancedMesh(bakedBillGeometry, billMats.face, instancedCount);
			instanced.castShadow = true;
			const m = new three.Matrix4();
			for (let i = 0; i < instancedCount; i++) {
				m.makeTranslation(0, thicknessM * (i + 0.5), 0);
				instanced.setMatrixAt(i, m);
			}
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
		}

		const remaining = count - instancedCount;
		if (remaining > 0) {
			const remainingHeightM = totalHeightM - instancedCount * thicknessM;
			const blockGeom = new three.BoxGeometry(widthM, remainingHeightM, lengthM);
			const edgeMat = billMats.edge.clone();
			edgeMat.map = edgeMat.map!.clone();
			edgeMat.map.repeat.set(1, remaining); // physically-honest stripe density (Task 10)
			edgeMat.map.needsUpdate = true;
			const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat];
			const block = new three.Mesh(blockGeom, blockMats);
			block.castShadow = true;
			block.position.y = instancedCount * thicknessM + remainingHeightM / 2;
			tierGroup.add(block);
		}

		scene.add(tierGroup);
		return totalHeightM;
	}
```

- [ ] **Step 2: Add the `viewMode` prop and branch the render effect**

Update the component's props declaration:

```typescript
	let {
		noteCount = 0,
		viewMode = $bindable<'tiered' | 'literal'>('tiered'),
	}: { noteCount?: number; viewMode?: 'tiered' | 'literal' } = $props();
```

Replace the `$effect` from Task 12 Step 2:

```typescript
	$effect(() => {
		const count = noteCount;
		const mode = viewMode;
		if (!canvasActive || !T || !bakedBillGeometry) return;
		import('../billStack.js').then((billStackMod) => {
			if (destroyed || !T) return;
			if (mode === 'literal') renderLiteral(T, billStackMod, count);
			else renderTiered(T, billStackMod, count);
			render();
		});
	});
```

- [ ] **Step 3: Manually verify**

Scratch-mount `<BillStage noteCount={110000} viewMode="literal" />` and confirm a single tall column renders (individually-instanced bills at the base transitioning into a coalesced block), height visually consistent with a ~12 m stack once the camera dolly (Task 14) is wired — camera framing itself is finished in the next task, so for this step it's fine if the column appears very small/large in frame; the check here is that geometry builds without console errors at `noteCount` values spanning every tier (`50`, `500`, `50000`, `5000000`, `50000000`) with `viewMode="literal"`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scene/BillStage.svelte
git commit -m "feat: render literal true-height bill stack"
```

---

## Task 14: Camera framing and the tiered/literal toggle

**Files:**
- Modify: `src/lib/scene/BillStage.svelte`

**Interfaces:**
- Consumes: `cameraTransform` from `./maths.js` (existing, unchanged — the same function that already frames the metal cubes across their full mm-to-monolith range)
- Produces: camera reframes to whatever `renderTiered`/`renderLiteral` reports as the dominant extent; clicking/tapping the stage (or Enter/Space when focused) toggles `viewMode`

- [ ] **Step 1: Wire camera framing to the render functions' return value**

Replace the `$effect` from Task 13 Step 2:

```typescript
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let prefersReduced = false;

	function reframe(three: typeof THREE, M: typeof import('./maths.js'), dominant: number): void {
		if (!camera || !camPos || !camAim) return;
		const safeDominant = Math.max(dominant, 1e-4);
		const tr = M.cameraTransform(safeDominant);
		wantPos = new three.Vector3(tr.pos.x, tr.pos.y, tr.pos.z);
		wantAim = new three.Vector3(tr.aim.x, tr.aim.y, tr.aim.z);
		if (prefersReduced) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
		camera.position.copy(camPos);
		camera.lookAt(camAim);
	}

	$effect(() => {
		const count = noteCount;
		const mode = viewMode;
		if (!canvasActive || !T || !bakedBillGeometry) return;
		Promise.all([import('../billStack.js'), import('./maths.js')]).then(([billStackMod, M]) => {
			if (destroyed || !T) return;
			const dominant = mode === 'literal' ? renderLiteral(T, billStackMod, count) : renderTiered(T, billStackMod, count);
			reframe(T, M, dominant);
			render();
		});
	});
```

- [ ] **Step 2: Add the damped camera loop (so the reframe on toggle/slider-move animates, matching LiveStage's existing dolly feel)**

```typescript
	let running = false;
	const clock = { last: 0 };

	function loop(): void {
		if (!running || destroyed || !T || !camera || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);
		const now = performance.now();
		const dt = Math.min((now - clock.last) / 1000 || 0, 0.05);
		clock.last = now;
		const k = 1 - Math.exp(-dt * 3.2); // same damping constant as LiveStage
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		render();
	}

	function startLoop(): void {
		if (running || destroyed) return;
		running = true;
		clock.last = performance.now();
		rafId = requestAnimationFrame(loop);
	}
	function stopLoop(): void {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}
```

Call `startLoop()` at the end of `hydrate()` (after `canvasActive = true;`), and call `stopLoop()` inside `teardown()`. Set `prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;` at the top of `onMount`'s callback, before `hydrate()` is invoked, matching `LiveStage`'s existing pattern.

- [ ] **Step 3: Add the toggle interaction**

Add to the `<script>` block:

```typescript
	function toggleViewMode(): void {
		viewMode = viewMode === 'tiered' ? 'literal' : 'tiered';
	}
```

Replace the template's root `<div>`:

```svelte
<div
	class="bill-stage"
	bind:this={containerEl}
	role="button"
	tabindex="0"
	aria-label={`Dollar bill stack, ${viewMode === 'tiered' ? 'bundled view — tap for the literal true-height stack' : 'literal true-height stack — tap for the bundled view'}`}
	onclick={toggleViewMode}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleViewMode();
		}
	}}
>
	<div class="mode-hint">{viewMode === 'tiered' ? 'tap to see it as one column' : 'tap to see it bundled'}</div>
</div>
```

Add to `<style>`:

```css
	.bill-stage {
		cursor: pointer;
	}
	.mode-hint {
		position: absolute;
		bottom: 8px;
		right: 12px;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #71717a;
		pointer-events: none;
		z-index: 1;
	}
```

- [ ] **Step 4: Manually verify the full toggle behavior**

Scratch-mount `<BillStage noteCount={110000} />`. Confirm: default view is tiered (roughly-cubic bundle grid), clicking anywhere on the stage smoothly dollies the camera and swaps to the literal single-column view, clicking again dollies back. Repeat with keyboard (Tab to focus the stage, press Enter) — same behavior. Test at a low count (`noteCount={50}`) and a high count (`noteCount={50000000}`) to confirm the camera reframes sensibly at both extremes without the object leaving the frame.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scene/BillStage.svelte
git commit -m "feat: add camera framing and tiered/literal toggle to BillStage"
```

---

## Task 15: Poster fallback (no-WebGL / pre-hydration)

**Files:**
- Create: `src/lib/components/BillRenderer.svelte`

**Interfaces:**
- Consumes: `Commodity` type, `selectBillTier`/`stackHeightMm`/`formatNoteCount`-style helpers (Tasks 1-5) — DOM/CSS only, no WebGL
- Produces: `<BillRenderer noteCount={number} />`, mountable standalone (used both as `BillStage`'s poster overlay and as the `/btc/cash` page's static poster, mirroring how `CubeRenderer` serves both roles for gold/silver/pu238)

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/components/BillRenderer.svelte -->
<script lang="ts">
	/**
	 * BillRenderer — CSS-only poster for the Cash tab. Visible to crawlers,
	 * JS-off visitors, and pre-hydration; anchors LCP the same way
	 * CubeRenderer does for the metal cubes. Always renders the tiered
	 * view (no toggle — the poster is a still).
	 */
	import { selectBillTier, stackHeightMm } from '$lib/billStack.js';
	import { formatNoteCount } from '$lib/format.js';

	let { noteCount = 0 }: { noteCount?: number } = $props();

	const tier = $derived(selectBillTier(noteCount));
	const heightMm = $derived(stackHeightMm(noteCount));

	function formatHeight(mm: number): string {
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		if (mm < 1_000_000) return `${(mm / 1000).toFixed(1)} m`;
		return `${(mm / 1_000_000).toFixed(1)} km`;
	}

	const tierLabel: Record<NonNullable<typeof tier>, string> = {
		loose: 'loose bills',
		strap: 'a strap of 100',
		bundle: 'bundles of 1,000',
		cube: 'a roughly-cubic bundle grid',
		pallet: 'a palletised field',
	};
</script>

<div class="bill-poster">
	{#if noteCount > 0 && tier}
		<div class="bill-icon" aria-hidden="true">$</div>
		<div class="bill-count">{formatNoteCount(noteCount)}</div>
		<div class="bill-tier">{tierLabel[tier]} · {formatHeight(heightMm)} stacked</div>
	{:else}
		<div class="empty-state">No data for this date</div>
	{/if}
</div>

<style>
	.bill-poster {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 100%;
		min-height: 200px;
		color: #e4e4e7;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
	}
	.bill-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: #2f5d3a;
		color: #e9e4d3;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 36px;
		font-weight: 700;
	}
	.bill-count {
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 1.5rem;
		font-weight: 600;
	}
	.bill-tier {
		font-size: 0.875rem;
		color: #a1a1aa;
	}
	.empty-state {
		color: #71717a;
		font-size: 0.875rem;
	}
</style>
```

- [ ] **Step 2: Manually verify**

Scratch-mount `<BillRenderer noteCount={110000} />` in a page without JS (or just visually confirm it renders correctly with JS on, since this repo has no no-JS test harness — same manual-verification convention as `CubeRenderer`'s poster role). Confirm it renders sensibly at `noteCount={0}` (empty state) and `noteCount={2310000000000}` (pallet tier, large formatted count).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BillRenderer.svelte
git commit -m "feat: add Cash poster/SSR fallback component"
```

---

## Task 16: BillReadout

**Files:**
- Create: `src/lib/components/BillReadout.svelte`

**Interfaces:**
- Consumes: `formatNoteCount` (Task 5), `formatMassConsumer` (existing, `$lib/format.js`), `stackHeightMm`/`nearestHeightComparison`/`selectBillTier`/`cubicGridDims` (Tasks 1-4), `system`/`toggleSystem` store (existing, `$lib/stores/system.js`, same one `CocaineReadout` uses)
- Produces: `<BillReadout noteCount={number} viewMode={'tiered'|'literal'} />`

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/components/BillReadout.svelte -->
<script lang="ts">
	/**
	 * BillReadout — the Cash tab's readout, shown under BillStage. Mirrors
	 * CocaineReadout's structure and the mass-first convention every other
	 * tab uses (see docs/handoff/14-cash.md, "Readout").
	 */
	import {
		BILL_WIDTH_MM,
		BILL_LENGTH_MM,
		selectBillTier,
		stackHeightMm,
		nearestHeightComparison,
		cubicGridDims,
		NOTES_PER_BUNDLE,
	} from '$lib/billStack.js';
	import { formatNoteCount, formatMassConsumer, formatLength } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';

	let {
		noteCount = 0,
		viewMode = 'tiered',
	}: { noteCount?: number; viewMode?: 'tiered' | 'literal' } = $props();

	const massGrams = $derived(noteCount); // BILL_MASS_G is 1 g/note
	const tier = $derived(selectBillTier(noteCount));
	const heightM = $derived(stackHeightMm(noteCount) / 1000);
	const comparison = $derived(nearestHeightComparison(heightM));

	const tierLabel: Record<NonNullable<typeof tier>, string> = {
		loose: 'loose bills',
		strap: 'a strap of 100',
		bundle: 'bundles of 1,000',
		cube: 'a roughly-cubic bundle grid',
		pallet: 'a palletised field',
	};

	const bundleGridLabel = $derived.by(() => {
		if (tier !== 'bundle' && tier !== 'cube') return null;
		const bundleCount = Math.ceil(noteCount / NOTES_PER_BUNDLE);
		const grid = cubicGridDims(
			bundleCount,
			BILL_WIDTH_MM,
			BILL_LENGTH_MM,
			NOTES_PER_BUNDLE * 0.10922
		);
		return `${grid.colsX} x ${grid.colsZ} x ${grid.layersY} bundles`;
	});

	function onSwap(e: Event) {
		e.preventDefault();
		toggleSystem();
	}
	function onSwapKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleSystem();
		}
	}
</script>

<div class="bill-readout">
	<div class="eyebrow">You could stack</div>

	{#if noteCount > 0}
		<div class="bill-count-row">{formatNoteCount(noteCount)}</div>

		<div
			class="bill-mass-row"
			role="button"
			tabindex="0"
			title="Click to switch units"
			onclick={onSwap}
			onkeydown={onSwapKey}
		>
			{formatMassConsumer(massGrams, $system)}
		</div>

		<div class="bill-secondary-row">
			{#if viewMode === 'literal'}
				{formatLength(heightM, $system)}
				{#if comparison}
					· about {comparison.multiple < 10 ? comparison.multiple.toFixed(1) : Math.round(comparison.multiple).toLocaleString('en-US')}x {comparison.label}
				{/if}
			{:else if tier}
				{tierLabel[tier]}{bundleGridLabel ? ` · ${bundleGridLabel}` : ''}
			{/if}
		</div>
	{:else}
		<div class="bill-count-row bill-count-empty">—</div>
	{/if}

	<div class="bill-exactness-note">
		Priced exactly: one $1 note is worth $1. No market estimate.
	</div>

	<div class="bill-rule" aria-hidden="true"></div>

	<p class="sources-footer">
		U.S. Bureau of Engraving and Printing (note dimensions) ·
		<a href="/methodology" class="link">methodology</a> ·
		<a href="/data" class="link">dataset</a>
	</p>
</div>

<style>
	.bill-readout {
		display: flex;
		flex-direction: column;
		width: 100%;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		color: #e4e4e7;
	}
	.eyebrow {
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 14px;
	}
	.bill-count-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 40px;
		font-weight: 600;
		color: #fafafa;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.bill-count-empty {
		color: #52525b;
	}
	.bill-mass-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 22px;
		font-weight: 500;
		color: #a1a1aa;
		margin-top: 4px;
		cursor: pointer;
		align-self: flex-start;
	}
	.bill-secondary-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		color: #71717a;
		margin-top: 10px;
	}
	.bill-exactness-note {
		font-size: 12px;
		color: #71717a;
		margin: 16px 0 0;
		line-height: 1.5;
	}
	.bill-rule {
		height: 1px;
		background: #27272a;
		margin: 14px 0;
	}
	.sources-footer {
		margin: 0;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 10.5px;
		color: #52525b;
		letter-spacing: 0.04em;
		line-height: 1.6;
	}
	.link {
		color: #71717a;
		text-decoration: underline;
	}
	.link:hover {
		color: #a1a1aa;
	}
</style>
```

- [ ] **Step 2: Manually verify against the worked table**

Scratch-mount `<BillReadout noteCount={110000} viewMode="literal" />` and confirm the readout shows: "110,000 bills", "110 kg" (or "242.5 lb" toggled), height "~12.0 m", and a comparison line ("~5.9x a doorway"). Switch `viewMode` to `"tiered"` and confirm it instead shows the tier label + bundle grid dimensions. Repeat at `noteCount={2310000000000}` and confirm "2.31 trillion bills", "2,310,000.00 tonnes" (via `formatMassConsumer`), and (in literal mode) the Karman-line comparison.

Run: `npx vitest run` — expect PASS (no new pure-logic in this component; all its maths is re-used from Tasks 1-5, already tested).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BillReadout.svelte
git commit -m "feat: add Cash readout with mass, height, and comparison line"
```

---

## Task 17: Wire the 5th HeroStage tab

**Files:**
- Modify: `src/lib/components/HeroStage.svelte`

**Interfaces:**
- Consumes: `BillStage` (Task 14), `BillReadout` (Task 16), `computeMassGrams` (existing — already generic, needs no change), `commodities` prop already includes `cash` once `src/routes/+page.svelte`'s `HERO_COMMODITIES` picks up the updated `LAUNCH_COMMODITIES` (Task 6) automatically
- Produces: a 5th selectable tab labeled "Cash"; when active, renders `BillStage`/`BillReadout` instead of `LiveStage`/`ReadoutStrip` or `CocaineBrickStack`/`CocaineReadout`

- [ ] **Step 1: Import the new components and add the `isCash` branch**

In `src/lib/components/HeroStage.svelte`, add imports near the top (with the other component imports, around line 25):

```typescript
	import BillStage from '$lib/scene/BillStage.svelte';
	import BillReadout from './BillReadout.svelte';
```

Add the derived flag next to `isCocaine` (around line 54):

```typescript
	const isCash = $derived(active.id === 'cash');
```

Extend `commodityAccent` (around line 64-77) with a US-currency green:

```typescript
	function commodityAccent(id: string): string {
		switch (id) {
			case 'gold':
				return '#d4a14a';
			case 'silver':
				return '#c5cdd6';
			case 'pu238':
				return '#7ed4ff';
			case 'cocaine':
				return '#e8e0d2';
			case 'cash':
				return '#85bb65';
			default:
				return '#d4a14a';
		}
	}
```

Extend the bot-readiness gate (around line 91-93) — Cash needs the same "don't advertise `data-commodity` until the visual has actually mounted" treatment as Cocaine:

```typescript
	let billStageEl: HTMLElement | undefined = $state();
	const billReady = $derived(isCash && !!billStageEl);
	const dataCommodity = $derived(
		isCocaine ? (brickReady ? 'cocaine' : '') : isCash ? (billReady ? 'cash' : '') : selectedId
	);
```

- [ ] **Step 2: Branch the stage and readout markup**

Replace the stage-selection block (around line 166-178):

```svelte
	{#if isCocaine}
		<div class="brick-frame" bind:this={brickEl}>
			<CocaineBrickStack {massGrams} />
		</div>
	{:else if isCash}
		<div class="bill-frame" bind:this={billStageEl}>
			<BillStage noteCount={amount} />
		</div>
	{:else}
		<LiveStage commodity={active} {amount} bind:staged />
	{/if}
```

Replace the readout-selection block (around line 191-233), adding the `isCash` branch alongside the existing `isCocaine`/else structure:

```svelte
	{#if isCocaine}
		<div class="readout-wrap">
			<CocaineReadout {massGrams} {btcAmount} {btcUsdPrice} {accent} />
		</div>
	{:else if isCash}
		<div class="readout-wrap">
			<BillReadout noteCount={amount} />
		</div>
	{:else}
		<div class="readout-wrap">
			<ReadoutStrip
				commodity={active}
				{amount}
				{btcAmount}
				{btcUsdPrice}
				{meltWarning}
				eyebrow="You could carry"
				{accent}
				activityCi={isPu ? activityCiText : null}
				activityDps={isPu ? dpsBig : null}
			/>
			{#if staged}
				<p class="staging-line">Shiba standing nearer the camera — true perspective, not rescaled.</p>
			{/if}
		</div>

		{#if isPu}
			<div class="card-wrap">
				<Pu238FactCard currentMassGrams={massGrams} {accent} />
			</div>
			<p class="sources-footer">
				DOE Office of Nuclear Energy · NASA Planetary Science · The Planetary Society ·
				Cassini OIG (1997, escalated) ·
				<a href="/methodology" class="link">methodology</a> ·
				<a href="/data" class="link">dataset</a>
			</p>
		{:else}
			<div class="card-wrap">
				<QuantityAnchorCard commodityId={active.id} currentMassKg={massKg} {accent} eyebrow="For scale" />
			</div>
		{/if}
	{/if}
```

(Cash gets neither the `Pu238FactCard`/sources-footer branch nor `QuantityAnchorCard` — same "no quantity anchors" call as Cocaine, since `quantity-anchors.json` is mass-keyed and Cash's comparison ladder is bespoke and height-based, already inside `BillReadout`.)

Add `.bill-frame { width: 100%; }` to the `<style>` block, next to the existing `.brick-frame` rule.

- [ ] **Step 3: Manually verify end-to-end**

Run `npm run dev`, open the homepage, click through all 5 tabs (Gold, Silver, Plutonium-238, Cocaine, Cash) in order and back. Confirm: Cash tab shows the 3D bill stage + readout, the accent color is the new green, switching away from Cash and back doesn't leak a second WebGL context (watch the browser console for context-related warnings), and the slider still drives `noteCount` correctly (move the slider, confirm the readout's note count changes).

Run: `npx vitest run` — expect PASS (no new pure logic in this task).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/HeroStage.svelte
git commit -m "feat: wire cash as the 5th hero tab"
```

---

## Task 18: /btc/cash SEO landing page

**Files:**
- Modify: `src/lib/seo/commodity-content.ts` (add `cash` entry)
- Modify: `src/routes/btc/[commodity]/+page.server.ts` (`formatRatio` gains a `unit === 'note'` branch)
- Modify: `src/routes/btc/[commodity]/+page.svelte` (`showPoster` gains a `bill_stack` branch, reusing `BillRenderer` as the poster)

**Interfaces:**
- Consumes: `getCommodity('cash')` (Task 6), `computeCommodityAmount` (Task 7), `formatNoteCount` (Task 5), `BillRenderer` (Task 15)
- Produces: a working, prerendered `/btc/cash` page

- [ ] **Step 1: Add the content entry**

In `src/lib/seo/commodity-content.ts`, add after the `cocaine` entry (before the closing `};` of `COMMODITY_CONTENT`):

```typescript
	cash: {
		title: 'Bitcoin to Cash: How Many $1 Bills Does 1 BTC Buy?',
		h1: 'Bitcoin to cash: how many $1 bills does 1 BTC buy?',
		metaDescription:
			"How many physical $1 bills does 1 bitcoin buy, stacked to their real thickness? Exact by construction (one note is worth one dollar) — no market estimate, priced from the live BTC-USD rate.",
		intro: [
			"One bitcoin currently buys roughly {ratio}. Unlike every other commodity on this site, Cash has no market price to estimate — a $1 Federal Reserve Note is worth exactly one dollar, so the figure is simply today's BTC-USD price with no ratio to look up. What the visualisation adds is the physical dimension: stacked to the Bureau of Engraving and Printing's published note thickness (0.10922 mm, 0.0043 in), how tall would that many bills actually stand?",
			"The 3D stack on the homepage toggles between two views: an auto-selected bundle view that groups notes into the real units cash handlers use (straps of 100, bundles of 1,000, and — past a hundred thousand notes — a roughly cube-shaped stack of bundles), and a literal view showing one true-height column, however tall that turns out to be.",
		],
		context: [
			'A $1 note measures 156.6 x 66.3 mm and weighs about 1 gram, identical across every US denomination. A strap of 100 notes is 10.922 mm thick — the Bureau of Engraving and Printing\'s own public trivia cites this as roughly 0.43 inches, a useful cross-check on the dimensions this page uses throughout.',
			"Because the price is exact rather than estimated, Cash carries none of the uncertainty bands that accompany the site's illustrative commodities (Cocaine, Plutonium-238). The only thing that moves the figure day to day is the live BTC-USD rate itself.",
		],
		faqs: [
			{
				question: 'How many $1 bills does 1 bitcoin buy today?',
				answer:
					"About {ratio} — exactly today's BTC-USD price, since one $1 note is worth one dollar by definition.",
			},
			{
				question: 'How tall would that stack of bills actually be?',
				answer:
					"Stacked to the real note thickness of 0.10922 mm each (per the Bureau of Engraving and Printing), the homepage visualisation computes the exact height and compares it to real-world landmarks — a doorway, the Burj Khalifa, even the edge of space at extreme bitcoin amounts.",
			},
			{
				question: 'Why is this priced differently from Gold, Silver, or Cocaine?',
				answer:
					"Every other commodity on the site is converted through a market price (gold spot, an illustrative cocaine estimate, and so on). A dollar bill has no such conversion to make — it is worth exactly one dollar — so Cash is the one commodity on the site with zero pricing uncertainty.",
			},
			{
				question: 'What do the "bundle" and "cube" views mean?',
				answer:
					'They mirror how cash is actually handled: straps of 100 notes, bundles of 1,000 (10 straps), and past about a hundred thousand notes, bundles arranged into a roughly cube-shaped stack rather than one impractically tall column. Tap the visualisation to switch to the literal true-height single column instead.',
			},
			{
				question: 'Is this in the downloadable dataset?',
				answer:
					'The BTC-USD price that drives this page is in the /data archive; the note-dimension constants are documented at /methodology but are not a separate data series, since they never change.',
			},
		],
		relatedPages: RELATED_DEFAULT,
	},
```

- [ ] **Step 2: Extend `formatRatio` for note counts**

In `src/routes/btc/[commodity]/+page.server.ts`, add a branch to `formatRatio` (before the final `return`):

```typescript
	if (c.unit === 'note') {
		if (amount >= 1_000_000) return formatNoteCountForRatio(amount);
		return `${Math.round(amount).toLocaleString('en-US')} $1 bills`;
	}
```

Add the small local helper above `formatRatio` (this file doesn't import from `$lib/format.js` today — keep it self-contained rather than adding a cross-boundary import for one branch):

```typescript
function formatNoteCountForRatio(amount: number): string {
	if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(2)} trillion $1 bills`;
	if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} billion $1 bills`;
	return `${(amount / 1_000_000).toFixed(2)} million $1 bills`;
}
```

- [ ] **Step 3: Add the poster branch**

In `src/routes/btc/[commodity]/+page.svelte`, update the `showPoster` derivation and add the Cash poster branch:

```typescript
	const showPoster = (data.renderStyle === 'cube' || data.renderStyle === 'bill_stack') && data.amount !== null;
```

Find where `CommodityPoster` is rendered conditionally on `showPoster` and add a sibling branch for `bill_stack` (import `BillRenderer` at the top of the file):

```typescript
	import BillRenderer from '$lib/components/BillRenderer.svelte';
```

```svelte
{#if showPoster}
	{#if data.renderStyle === 'bill_stack'}
		<BillRenderer noteCount={data.amount ?? 0} />
	{:else}
		<CommodityPoster commodity={data.commodity} amount={data.amount} />
	{/if}
{:else if data.dataQuality === 'illustrative'}
	<!-- existing illustrative-price callout, unchanged -->
{/if}
```

(Locate the exact existing conditional structure around this component first — `showPoster` currently gates a single `<CommodityPoster>` call; wrap it as shown, preserving whatever sits in the `{:else if data.dataQuality === 'illustrative'}` branch untouched.)

- [ ] **Step 4: Verify the page builds and renders**

Run: `npm run build` — expect `/btc/cash` to prerender successfully (check `build/btc/cash.html` or `build/btc/cash/index.html` exists afterward, matching the existing output shape for `/btc/cocaine`).

Run: `npm run dev`, navigate to `/btc/cash`, confirm: h1/intro/context/FAQs render with `{ratio}` substituted for a real number, the poster (`BillRenderer`) shows a sensible tiered summary, breadcrumb and canonical URL are correct, no console errors.

Run: `npx vitest run` — expect PASS (no new pure logic; `formatNoteCountForRatio` is small enough to verify via the manual build/dev check above rather than a dedicated unit test, consistent with how `formatRatio`'s existing branches for `troy_oz`/`gram` are untested today).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/commodity-content.ts src/routes/btc/[commodity]/+page.server.ts src/routes/btc/[commodity]/+page.svelte
git commit -m "feat: add /btc/cash SEO landing page"
```

---

## Task 19: Homepage card and FAQ

**Files:**
- Modify: `src/routes/+page.svelte` (add a 5th `seo-card` entry)
- Modify: `src/lib/seo/faqs.ts` (optionally extend `HOMEPAGE_FAQS`)

**Interfaces:**
- Consumes: nothing new
- Produces: homepage "Per-commodity deep-dives" grid links to `/btc/cash`; `HOMEPAGE_FAQS` gains one Cash-related entry

- [ ] **Step 1: Add the homepage card**

In `src/routes/+page.svelte`, inside the `<ul class="seo-cards">` block (around line 638-663), add after the Cocaine `<li>`:

```svelte
					<li>
						<a href="/btc/cash" class="seo-card">
							<span class="seo-card__title">BTC → Cash</span>
							<span class="seo-card__sub">A literal stack of $1 bills, to true thickness.</span>
						</a>
					</li>
```

- [ ] **Step 2: Add one homepage FAQ entry**

In `src/lib/seo/faqs.ts`, add to `HOMEPAGE_FAQS` (matching the existing entries' shape — check an existing entry's exact field names before writing this, they should be `{ question, answer }` per `FaqEntry`):

```typescript
	{
		question: 'How tall would a bitcoin\'s worth of $1 bills actually stack?',
		answer:
			"It depends on the amount and the date, but the site computes it exactly: stacked to the real 0.10922 mm note thickness (Bureau of Engraving and Printing), then compared to real-world landmarks from a doorway up to the edge of space. See the Cash tab on the homepage, or /btc/cash for the current figure.",
	},
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, scroll to the homepage's "Per-commodity deep-dives" section, confirm the 5th card renders and links to `/btc/cash`. Scroll to the FAQ section, confirm the new question renders.

Run: `npx vitest run` — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/lib/seo/faqs.ts
git commit -m "feat: add cash homepage card and FAQ entry"
```

---

## Task 20: Methodology page

**Files:**
- Modify: `src/routes/methodology/+page.svelte`

**Interfaces:**
- Consumes: nothing new
- Produces: a new "Cash (derived, no API)" subsection inside the existing `id="data-sources"` section

- [ ] **Step 1: Add the subsection**

In `src/routes/methodology/+page.svelte`, inside `<section id="data-sources">`, after the existing `<h3>Derived (no API)</h3>` block (the BTC-supply paragraph), add:

```svelte
				<h3>Cash (derived, no API)</h3>
				<p>
					The Cash commodity has no price to fetch: one $1 Federal Reserve Note is worth exactly
					one dollar, so its "price" is the constant 1, and the note count is simply the live
					BTC-USD value. The only external data are fixed physical constants from the U.S. Bureau
					of Engraving and Printing — note length 155.956&nbsp;mm (6.14&nbsp;in), width
					66.294&nbsp;mm (2.61&nbsp;in), thickness 0.10922&nbsp;mm (0.0043&nbsp;in), mass
					1&nbsp;g — identical across every denomination and unchanged since the note's current
					size was adopted in 1929. These live in <code>src/lib/billStack.ts</code> and are
					cross-checked in that file's tests against the Bureau's own public trivia that a
					banded strap of 100 notes runs about 0.43&nbsp;inches thick.
				</p>
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, navigate to `/methodology`, confirm the new subsection renders under "Data sources" and the table of contents still resolves (the `data-sources` anchor already exists, so no `sections` array change is needed).

Run: `npx vitest run` — expect PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/methodology/+page.svelte
git commit -m "docs: document cash's derived (no-API) pricing in methodology"
```

---

## Task 21: og-image support for Cash

**Files:**
- Modify: `functions/_lib.ts` (add a `cash` entry to `OG_COMMODITIES`)

**Interfaces:**
- Consumes: nothing new — `computeAmount`, `massGrams`, `formatHeadlineAmount` etc. in `_lib.ts` are unchanged; the `dataQuality: 'illustrative'` branch already used by `pu238`/`cocaine` is reused to get a fixed unit price with zero logic changes
- Produces: `/og-image?btc=1&commodity=cash` renders Cash's own figures instead of silently falling back to Gold's

This is a real gap, not a deferred nice-to-have: `functions/_lib.ts` is a hand-maintained duplicate of `src/lib/commodities.ts` (Pages Functions can't import across the SvelteKit `src` boundary — see that file's header comment), keyed by commodity id in `OG_COMMODITIES`. Confirmed by reading `functions/og-image.ts:296-298`: an id with no entry in `OG_COMMODITIES` silently renders as **Gold** (`OG_COMMODITIES[commodityId] ?? OG_COMMODITIES.gold`) — not a crash, a wrong social-preview card. Also confirmed by reading `_lib.ts`: `dataQuality` is never read by `og-image.ts` itself (only by `_lib.ts`'s own `computeAmount`), so tagging Cash `'illustrative'` here is purely an internal mechanism to get a fixed unit price — it does not put an "illustrative" label on the rendered image (verified: `grep -n "illustrative" functions/og-image.ts` returns nothing).

- [ ] **Step 1: Add the OG_COMMODITIES entry**

In `functions/_lib.ts`, add to `OG_COMMODITIES` (after the `cocaine` entry):

```typescript
	cash: {
		id: 'cash',
		displayName: 'cash',
		unit: 'gram',
		unitLabel: 'g',
		unitMassGrams: 1, // one $1 note = 1 g, so amount (note count) already equals grams
		// No density — cash renders still-mode like cocaine, no cube/volume readout.
		priceField: 'usd_note', // unused — dataQuality 'illustrative' below bypasses the day[priceField] lookup
		dataQuality: 'illustrative',
		illustrativePricePerUnit: 1, // one $1 note is worth exactly one dollar
		accentColor: '#85bb65',
	},
```

- [ ] **Step 2: Manually verify**

Run `npm run dev` (or `npx wrangler pages dev` if that's how Pages Functions are locally served in this repo — check `package.json`/`wrangler.toml` for the exact local-dev command already in use), then request `/og-image?btc=1&commodity=cash` and confirm the rendered image shows Cash's own accent color (`#85bb65`) and a mass readout consistent with the current BTC price (not Gold's amber cube). Compare against `/og-image?btc=1&commodity=cocaine` to confirm Cash renders in the same still-mode layout (no cube/Shiba), not a broken one.

- [ ] **Step 3: Commit**

```bash
git add functions/_lib.ts
git commit -m "fix: add cash to og-image commodity table, was silently rendering as gold"
```

---

## Task 22: Final integration pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run the full automated test suite**

Run: `npx vitest run`
Expected: PASS, all tests (existing + every test file added in Tasks 1-7)

- [ ] **Step 2: Run a full production build**

Run: `npm run build`
Expected: builds cleanly, `/btc/cash` present in `build/`, no TypeScript errors, no Svelte compiler warnings introduced by this feature (pre-existing warnings elsewhere are out of scope)

- [ ] **Step 3: Manually walk the five canonical positions from the design spec, in both view modes**

Run `npm run dev`, open the homepage, select the Cash tab, and for each of the slider positions below confirm the stage renders without console errors and the readout's numbers match:

| BTC | Expected notes | Expected mass | Expected tier (tiered mode) | Expected height (literal mode) |
|---|---|---|---|---|
| 1 sat | 0 | 0 g | empty state | — |
| 0.001 BTC | 110 | 110 g | strap | ~12 mm |
| 1 BTC | 110,000 | 110 kg | cube (roughly-cubic grid) | ~12 m |
| 100 BTC | 11,000,000 | 11 tonnes | pallet | ~1.2 km |
| 21,000,000 BTC | ~2.31 trillion | ~2,310,000 tonnes | pallet | ~252,298 km |

(BTC-USD price varies day to day — recompute the expected notes/mass from whatever the dev server's live price actually is using `notes = btc * btcUsdPrice`, `mass_g = notes`, rather than treating the $110,000 assumption above as exact.)

- [ ] **Step 4: Confirm no regressions on the other four tabs**

Click through Gold, Silver, Plutonium-238, and Cocaine, and confirm each still renders and behaves exactly as before this feature branch (slider sync, share button, quantity-anchor cards, Pu-238 Geiger audio, Cocaine tiers all unchanged).

- [ ] **Step 5: Confirm the og-image endpoint (Task 21) renders correctly for Cash**

Request `/og-image?btc=1&commodity=cash` once more alongside the other four commodities' og-images, side by side, to confirm Cash's card doesn't look out of place (accent color, layout) next to the rest.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status
```

Review the output — if anything unexpected is staged, unstage it (`git restore --staged <file>`) before committing. Otherwise:

```bash
git commit -m "chore: cash feature complete — verified at all five canonical positions"
```

(Skip this final commit if Steps 1-5 turned up nothing to fix and every prior task's commit already covers everything — don't create an empty commit.)

---

## Follow-ups (explicitly out of scope for this plan)

Carried over from `docs/handoff/14-cash.md`'s "Out of scope" section, plus items identified during planning:

- Photorealistic or licensed bill artwork (procedural stylized texture is the intended permanent choice, not a placeholder).
- Non-USD denominations or non-$1 notes.
- Bespoke per-tier og-image *art* for Cash (Task 21 fixes correctness — Cash renders with its own figures and accent color — but reuses the existing still-mode layout rather than custom artwork, matching Cocaine's OG treatment).
- Decorative banded-strap/shrink-wrap-bundle textures distinguishing `loose` from `strap` and dressing up the `bundle`/`cube` blocks beyond their plain edge-stripe texture (Task 12's explicit visual simplification) — the tier *labels and numbers* are always correct today; this is pure visual polish.
- Perf-tuning the `LITERAL_INSTANCE_CAP` (2,000) and `PALLET_RENDER_CAP` (60) constants against real device profiling — the plan picks conservative starting values known to be safe, not values validated against a performance budget.
- `PhysicalRep.svelte`'s `renderStyle` switch (`cube`/`progression`/`vessel`/`bulk`, no `bill_stack` branch) — per `docs/handoff/14-cash.md`, this component is believed dead/unused at MVP (every other `renderStyle` value it doesn't branch on is already "legacy, unused at MVP" per `commodities.ts`'s own comments); Task 22's regression pass is the place to notice if it turns out still to be live somewhere, in which case it needs a graceful pass-through, not a full render path.
