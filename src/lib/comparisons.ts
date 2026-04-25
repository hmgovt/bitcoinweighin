/**
 * Text-comparison cards for extreme scales.
 *
 * When the commodity's displayed size exceeds ~5 m, the renderer stops
 * trying to show true scale and shows a relatable text card instead.
 */

interface ComparisonEntry {
	min: number;
	max: number | null;
	template: string;
}

const BY_MASS_KG: ComparisonEntry[] = [
	{ min: 1, max: 10, template: 'about the weight of a bag of sugar' },
	{ min: 10, max: 100, template: 'about {n} car tyres (~15 kg each)' },
	{ min: 100, max: 1000, template: 'about the weight of a small motorcycle' },
	{ min: 1000, max: 10000, template: 'about the weight of a small car' },
	{ min: 10000, max: 100000, template: 'about {n} London double-decker buses (~12 t each)' },
	{ min: 100000, max: 1000000, template: 'about {n} blue whales (~150 t each)' },
	{ min: 1000000, max: null, template: 'about {n} fully loaded freight trains (~4,000 t each)' },
];

const BY_VOLUME_M3: ComparisonEntry[] = [
	{ min: 1, max: 33, template: 'about the volume of {n} bathtubs (~0.3 m³ each)' },
	{ min: 33, max: 2500, template: 'about {n} shipping containers (33 m³ each)' },
	{ min: 2500, max: null, template: '≈ {n} Olympic swimming pools (2,500 m³ each)' },
];

function findCard(entries: ComparisonEntry[], value: number): string | null {
	for (const entry of entries) {
		if (value >= entry.min && (entry.max === null || value < entry.max)) {
			// Compute {n} as the ratio to the reference object
			const refSize = parseRefSize(entry.template);
			if (refSize && value > refSize) {
				const n = value / refSize;
				const formatted = n >= 10 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1);
				return entry.template.replace('{n}', formatted);
			}
			return entry.template.replace('{n}', '1');
		}
	}
	return null;
}

function parseRefSize(template: string): number | null {
	// Extract reference sizes from templates like "~12 t each" or "~150 t each"
	const match = template.match(/~([\d,]+(?:\.\d+)?)\s*(kg|t|m³)/);
	if (!match) return null;
	const val = parseFloat(match[1].replace(',', ''));
	if (match[2] === 't') return val * 1000; // convert tonnes to kg
	return val;
}

export function getComparisonByMass(massKg: number): string | null {
	return findCard(BY_MASS_KG, massKg);
}

export function getComparisonByVolume(volumeM3: number): string | null {
	return findCard(BY_VOLUME_M3, volumeM3);
}
