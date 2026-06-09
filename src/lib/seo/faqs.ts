/**
 * Curated FAQ entries. The same strings render on the page and inside
 * the FAQPage JSON-LD — Google requires the structured data to mirror
 * visible content verbatim, so the source of truth lives here and both
 * consumers read from it.
 */

export interface FaqEntry {
	question: string;
	answer: string;
}

export const HOMEPAGE_FAQS: FaqEntry[] = [
	{
		question: 'What is Bitcoin Weigh-In?',
		answer:
			"Bitcoin Weigh-In visualises one bitcoin's purchasing power as physical commodities you can actually hold — gold, silver, plutonium-238, cocaine — rendered at true relative scale next to a constant reference (a 9-kg Shiba Inu). It pairs a live, daily-updated price dataset with a side-by-side cube renderer so a glance tells you how heavy a bitcoin is, today, in things that exist.",
	},
	{
		question: 'How much gold can 1 bitcoin buy today?',
		answer:
			'The exact ratio updates every day at 02:00 UTC from stooq XAUUSD spot prices. Move the slider on the homepage or open /btc/gold to see the current troy-ounce equivalent, plus the historical curve back to 2013.',
	},
	{
		question: 'How is the bitcoin-to-commodity price calculated?',
		answer:
			"Each day's BTC-USD close (from stooq) is divided by the commodity's USD-denominated close from the same trading day. Spot prices come from stooq (gold, silver, platinum, copper, coffee) and FRED (Brent crude). Bitcoin circulating supply is computed deterministically from the protocol's halving schedule. The full methodology is published at /methodology.",
	},
	{
		question: 'Is the underlying dataset free to use?',
		answer:
			'Yes — the full daily history of commodity-vs-BTC prices is published under Creative Commons CC-BY-4.0 as CSV, JSON, NDJSON, and Parquet at /data. Cite it as Bitcoin Weigh-In; attribution is the only restriction.',
	},
	{
		question: 'How often does the price data update?',
		answer:
			'The dataset rebuilds every day at 02:00 UTC via a GitHub Actions cron that fetches the previous UTC day from each source, cross-validates against Massive, and commits the new artifacts to the public repository. Forward-fill carries the previous known value across weekends and holidays so every calendar date has a row.',
	},
	{
		question: 'Which commodities are covered?',
		answer:
			"The live dataset covers BTC, gold, silver, platinum, copper, Brent crude, wheat, and coffee. The visualisation currently renders four — gold, silver, plutonium-238, and cocaine — chosen for the spread of densities and price-per-gram they show. Plutonium-238 and cocaine are illustrative composite prices (no public spot market); their methodology is documented at /methodology.",
	},
];
