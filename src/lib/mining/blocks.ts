import type { HeaderSource } from './sha256.js';

/**
 * Real, consecutive block headers from mempool.space. The /mining page mines
 * the first one's template, replays its real find, then moves on to the next
 * — whose previous-block field is the first one's hash.
 *
 * Every hash on the page is computed from these; the page verifies each
 * header reproduces its published hash before using it.
 */
export const BLOCKS: HeaderSource[] = [
	{
		height: 968389,
		header:
			'000004208a814d4e99fbd3ec15aeb38115d4e047dca4e7a2421a02000000000000000000fb32c1acb630f084469cb9d94c51383575222fe4c09dd64cddb241bdf89cd0a7a705b56ac51e0217cc15444b',
		hash: '00000000000000000001052f3e2b35dc9386679b641733c2d54da5729163a06d',
	},
	{
		height: 968390,
		header:
			'00003d236da0639172a54dd5c23317649b678693dc352b3e2f05010000000000000000003f5ec9375cd7f7b07ba503e6a9f48b716aee5d004b31167a64adc88e86250dda6507b56ac51e02176c3523d9',
		hash: '00000000000000000000642f5c57e8576152c14b7a5f14e7bae362ab35007dbe',
	},
];
