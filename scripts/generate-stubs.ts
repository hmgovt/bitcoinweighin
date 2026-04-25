/**
 * Generate stub SVG sprites for the gold 10-stage progression.
 *
 * Each stub is a flat-coloured rectangle at correct aspect ratio with
 * a visible stage label. Tile-mode stages get 5 fill-state variants.
 *
 * Run: npx tsx scripts/generate-stubs.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUBS_DIR = join(__dirname, '..', 'static', 'sprites', 'gold', '_stubs');
mkdirSync(STUBS_DIR, { recursive: true });

interface StubDef {
	id: string;
	/** Width in pixels at 2x density */
	width: number;
	/** Height in pixels at 2x density */
	height: number;
	/** Whether this is an isometric stage (wider aspect) */
	isometric: boolean;
	/** Background colour */
	bgColor: string;
	/** Border colour */
	borderColor: string;
	/** Whether this stage has tile fill-state variants */
	hasFillStates: boolean;
	/** Label shown on the stub */
	label: string;
}

const stages: StubDef[] = [
	{
		id: 'dust',
		width: 400, height: 400,
		isometric: false,
		bgColor: '#78350f', borderColor: '#92400e',
		hasFillStates: false,
		label: 'DUST\n(on £1 coin)',
	},
	{
		id: 'nugget_cluster',
		width: 400, height: 380,
		isometric: false,
		bgColor: '#713f12', borderColor: '#a16207',
		hasFillStates: false,
		label: 'NUGGET\nCLUSTER',
	},
	{
		id: 'coin',
		width: 400, height: 400,
		isometric: false,
		bgColor: '#854d0e', borderColor: '#ca8a04',
		hasFillStates: false,
		label: 'COIN\n(1 oz Britannia)',
	},
	{
		id: 'tube',
		width: 300, height: 500,
		isometric: false,
		bgColor: '#854d0e', borderColor: '#eab308',
		hasFillStates: false,
		label: 'TUBE\n(20 Britannias)',
	},
	{
		id: 'small_bar',
		width: 500, height: 300,
		isometric: false,
		bgColor: '#a16207', borderColor: '#eab308',
		hasFillStates: false,
		label: 'SMALL BAR\n(100 g LBMA)',
	},
	{
		id: 'kilo_bar',
		width: 600, height: 350,
		isometric: false,
		bgColor: '#a16207', borderColor: '#facc15',
		hasFillStates: false,
		label: 'KILO BAR\n(1 kg)',
	},
	{
		id: 'good_delivery_single',
		width: 700, height: 400,
		isometric: false,
		bgColor: '#ca8a04', borderColor: '#fde047',
		hasFillStates: false,
		label: 'GOOD DELIVERY\n(400 oz / 12.4 kg)',
	},
	{
		id: 'bar_pyramid',
		width: 800, height: 470,
		isometric: true,
		bgColor: '#ca8a04', borderColor: '#fde047',
		hasFillStates: false,
		label: 'BAR PYRAMID\n(isometric)',
	},
	{
		id: 'pallet',
		width: 800, height: 470,
		isometric: true,
		bgColor: '#eab308', borderColor: '#fef08a',
		hasFillStates: true,
		label: 'PALLET',
	},
	{
		id: 'vault_multi_pallet',
		width: 800, height: 470,
		isometric: true,
		bgColor: '#facc15', borderColor: '#fef9c3',
		hasFillStates: true,
		label: 'VAULT\nMULTI-PALLET',
	},
];

function generateSvg(
	stage: StubDef,
	fillPercent?: number
): string {
	const { width, height, bgColor, borderColor, label } = stage;
	const labelText = fillPercent !== undefined
		? `${label} ${fillPercent}%`
		: label;

	// For fill-state variants, show a fill bar proportional to fillPercent
	const fillBar = fillPercent !== undefined
		? `<rect x="4" y="${height - (height - 8) * (fillPercent / 100) - 4}" width="${width - 8}" height="${(height - 8) * (fillPercent / 100)}" fill="${bgColor}" opacity="0.6" rx="2"/>`
		: '';

	const fillBg = fillPercent !== undefined ? '#27272a' : bgColor;

	const lines = labelText.split('\n');
	const lineHeight = 18;
	const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

	const textElements = lines.map((line, i) =>
		`<text x="${width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="central" fill="#fef3c7" font-family="monospace" font-size="14" font-weight="bold">${escapeXml(line)}</text>`
	).join('\n    ');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${fillBg}" rx="4" stroke="${borderColor}" stroke-width="3"/>
  ${fillBar}
  ${stage.isometric ? `<text x="${width - 8}" y="18" text-anchor="end" fill="${borderColor}" font-family="monospace" font-size="10" opacity="0.7">ISO</text>` : ''}
  ${textElements}
</svg>`;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Generate stubs
for (const stage of stages) {
	// Main sprite (used in scale mode and as 100% fill in tile mode)
	const mainSvg = generateSvg(stage);
	writeFileSync(join(STUBS_DIR, `${stage.id}.svg`), mainSvg);

	if (stage.hasFillStates) {
		// Generate 5 fill-state variants: 0, 25, 50, 75, 100
		for (const pct of [0, 25, 50, 75, 100]) {
			const fillSvg = generateSvg(stage, pct);
			writeFileSync(join(STUBS_DIR, `${stage.id}_fill_${pct}.svg`), fillSvg);
		}
	}
}

console.log(`Generated ${stages.length} stage stubs + fill variants in ${STUBS_DIR}`);
