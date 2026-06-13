/**
 * Per-commodity SEO copy and FAQ blocks for /btc/[commodity] landing pages.
 *
 * Keyed by the same `id` that lives in $lib/commodities.ts. Each entry holds:
 *   - title / h1 / metaDescription: page-level surfaces
 *   - intro: opening paragraph(s), 80-150 words, target-keyword bearing
 *   - context: market-context paragraph(s), 80-150 words
 *   - faqs: 4-6 Q&A pairs, mirror the FAQPage JSON-LD
 *
 * The strings include `{ratio}` and `{unitLabel}` placeholders for the
 * current value — substituted at render time. Keep markdown-free; the
 * page template treats them as plain text paragraphs.
 */

import type { FaqEntry } from './faqs.js';

export interface CommodityContent {
	title: string;
	h1: string;
	metaDescription: string;
	intro: string[];
	context: string[];
	faqs: FaqEntry[];
	/** Optional list of related anchor links to surface above the fold. */
	relatedPages?: Array<{ href: string; label: string }>;
}

const RELATED_DEFAULT = [
	{ href: '/btc/gold', label: 'BTC → gold' },
	{ href: '/btc/silver', label: 'BTC → silver' },
	{ href: '/btc/pu238', label: 'BTC → plutonium-238' },
	{ href: '/btc/cocaine', label: 'BTC → cocaine' },
];

export const COMMODITY_CONTENT: Record<string, CommodityContent> = {
	gold: {
		title: 'Bitcoin to Gold: How Much Gold Does 1 BTC Buy Today?',
		h1: 'Bitcoin to gold: how much gold does 1 BTC buy?',
		metaDescription:
			'How much gold does 1 bitcoin buy? Live BTC-to-gold ratio in troy ounces, with daily history back to 2013. Gold priced via Pax Gold (PAXG), a token tracking spot gold.',
		intro: [
			"One bitcoin currently buys roughly {ratio}. The ratio is recomputed every day at 02:00 UTC from the latest BTC-USD price (CoinGecko) and the gold price — taken from Pax Gold (PAXG), a token redeemable for one fine troy ounce of LBMA Good Delivery gold that trades within a small premium of spot. Move the slider on the homepage to see what a fractional or institutional-scale bitcoin position is worth in gold; the dataset goes back to 2 January 2013.",
			"Gold is the natural reference asset for any 'is bitcoin actually money?' question. It's mined at a roughly fixed 1.5% annual rate, has a four-thousand-year market history, and trades against every currency on the planet. A bitcoin's purchasing power in gold strips out fiat noise and leaves a pure scarcity-vs-scarcity ratio.",
		],
		context: [
			"Gold's density is 19.32 g/cm³ — almost the densest naturally occurring metal you can hold without specialist handling. A troy ounce (31.1035 g) of gold occupies just 1.61 cm³, smaller than a sugar cube. The cube renderer on the homepage and this page draws the volume to true scale next to a constant 9-kg Shiba Inu so the eye has a reference.",
			'For analysts, every BTC-to-gold pair in the dataset goes back to BTC\'s first liquid trading days. The full archive is published under CC-BY-4.0 at /data in CSV, JSON, NDJSON, and Parquet. The methodology page documents the data sources, the forward-fill rule that handles weekends and gaps, and the per-source health checks.',
		],
		faqs: [
			{
				question: 'How many troy ounces of gold does 1 bitcoin buy today?',
				answer:
					'About {ratio}. The number updates every day at 02:00 UTC from CoinGecko BTC-USD and the Pax Gold (PAXG) gold price.',
			},
			{
				question: 'How is the BTC-to-gold ratio calculated?',
				answer:
					"Each day's BTC-USD price is divided by the same day's gold price (USD per troy ounce). BTC and gold (via Pax Gold) both come from CoinGecko. The methodology page describes the forward-fill and per-source health-check rules.",
			},
			{
				question: 'Does the price include premiums for physical bullion?',
				answer:
					'No — the dataset uses spot (paper) gold. Physical-bullion premiums vary by product (coin, bar, refiner, region) and typically run 2–8% over spot. For investable comparison purposes, spot is the standard reference.',
			},
			{
				question: 'How far back does the BTC-to-gold history go?',
				answer:
					"To 2 January 2013, when BTC's USD market was first deep enough that a daily close is meaningful. Earlier prices exist but are too thin to be representative.",
			},
			{
				question: 'Can I download the raw data?',
				answer:
					'Yes. The full daily archive is published under CC-BY-4.0 at /data in CSV, JSON, NDJSON, and Parquet. The same data powers the homepage slider and this page.',
			},
		],
		relatedPages: RELATED_DEFAULT,
	},
	silver: {
		title: 'Bitcoin to Silver: How Much Silver Does 1 BTC Buy Today?',
		h1: 'Bitcoin to silver: how much silver does 1 BTC buy?',
		metaDescription:
			'How much silver does 1 bitcoin buy? Live BTC-to-silver ratio in troy ounces, with daily history back to 2013. Silver priced from GoldAPI.io spot.',
		intro: [
			"One bitcoin currently buys roughly {ratio}. The ratio is recomputed every day at 02:00 UTC from the latest BTC-USD price (CoinGecko) and the silver spot price (GoldAPI.io). The full history is published as a free CC-BY-4.0 dataset at /data so you can run your own gold-silver-bitcoin ratio analysis.",
			"Silver is the high-volatility cousin in the precious-metals stack. It tracks gold loosely but has industrial-demand exposure (solar PV, electronics, batteries) that breaks the correlation in either direction. Pricing BTC in silver tends to amplify whatever's happening in BTC-USD because silver itself is the noisier denominator.",
		],
		context: [
			'Silver is markedly less dense than gold — 10.49 g/cm³ versus 19.32 g/cm³ — so the same dollar value buys a much larger physical volume. The cube renderer on the homepage draws silver to true relative scale; at a thousand-USD position the cube is already palpably bigger than the equivalent gold cube. A US Mint "monster box" holds 500 troy oz; the comparison panel surfaces that as a tile when 1 BTC clears that threshold.',
			"For machine-readable access, the BTC-silver pair is in the full daily dataset at /data alongside gold and Brent crude, plus historical platinum, copper, wheat, and coffee. The /methodology page documents the GoldAPI.io silver feed, the forward-fill behaviour on weekends and gaps, and the per-source health checks.",
		],
		faqs: [
			{
				question: 'How many troy ounces of silver does 1 bitcoin buy today?',
				answer:
					'About {ratio}. Recomputed daily at 02:00 UTC from GoldAPI.io silver spot and CoinGecko BTC-USD.',
			},
			{
				question: 'How is the BTC-to-silver ratio calculated?',
				answer:
					"Each day's BTC-USD price divided by the same day's silver price (USD per troy ounce). BTC comes from CoinGecko, silver from GoldAPI.io. Full methodology is at /methodology.",
			},
			{
				question: 'Is this spot silver or physical bullion?',
				answer:
					'Spot. Physical silver coins (Silver Eagles, Maples) and bars typically trade at a 10–25% premium to spot — much higher than gold premiums because silver\'s lower unit value makes minting/handling costs a bigger fraction.',
			},
			{
				question: 'How does the bitcoin-silver ratio compare to gold-silver?',
				answer:
					'The classic gold-silver ratio has averaged around 60:1 over modern history (more silver per ounce of gold). Compounding that into BTC terms, you can read the BTC-silver ratio off the BTC-gold ratio multiplied by gold-silver. The dataset has both series so you can chart the divergence directly.',
			},
			{
				question: 'Where does the silver data come from?',
				answer:
					'GoldAPI.io spot (USD per troy ounce). Forward-filled on weekends and gaps. See /methodology for full source notes.',
			},
		],
		relatedPages: RELATED_DEFAULT,
	},
	pu238: {
		title: 'Bitcoin to Plutonium-238: How Much Pu-238 Does 1 BTC Buy?',
		h1: 'Bitcoin to plutonium-238: how much Pu-238 does 1 BTC buy?',
		metaDescription:
			'How much plutonium-238 does 1 bitcoin buy? Illustrative BTC-to-Pu-238 equivalence at a composite ~$5,000/g material cost — the radioisotope that powers Voyager and Mars rovers.',
		intro: [
			"One bitcoin currently buys roughly {ratio} of plutonium-238 at a composite material-cost estimate of about $5,000 per gram. This is an illustrative price — Pu-238 has no public spot market — derived from DOE Office of Nuclear Energy publications, NASA Planetary Science Division reports on the Pu-238 production program (~$150M/year for ~1.5 kg/year), and the Cassini OIG report from 1997. The full methodology is at /methodology.",
			"Pu-238 is the radioisotope that powers radioisotope thermoelectric generators (RTGs) — the heat-and-electricity sources on Voyager 1 and 2, Cassini, New Horizons, Curiosity, and Perseverance. It is non-fissile, not weapons material, and decays primarily by alpha emission with a specific activity around 17 Ci/g. It is also one of the most expensive materials anyone routinely manufactures.",
		],
		context: [
			'The cube depicts plutonium-238 in the form RTGs actually use: the ceramic oxide fuel, PuO₂, at its theoretical density of 11.46 g/cm³ — about the density of lead (real sintered pellets run 80–90% of theoretical). A million-dollar position still fits in a cube not much bigger than a sugar cube. The renderer draws it to true scale next to the universal Shiba Inu reference, with a thermal glow because the fuel genuinely runs hot — a single 150 W RTG cluster glows visibly.',
			'Because Pu-238 is an illustrative composite price rather than a market close, it is not in the machine-readable /data archive. The illustrative price lives in src/lib/illustrative-prices.json with provenance, sources, and an uncertainty band of roughly ±60%. A separately cited fully-loaded program cost (~$100,000/g) reflects the facility maintenance and regulatory infrastructure required for production but is less directly comparable to other commodities and so is not used for the headline BTC equivalence.',
		],
		faqs: [
			{
				question: 'How much plutonium-238 does 1 bitcoin buy today?',
				answer:
					'About {ratio} at the illustrative material-cost estimate of ~$5,000 per gram. The estimate carries roughly ±60% uncertainty; see /methodology for the source decomposition.',
			},
			{
				question: 'Why is Pu-238 so expensive?',
				answer:
					"It's not naturally occurring at useful concentrations and has to be bred in reactors, then chemically separated and ceramicised — a multi-year, highly regulated process. The DOE/NASA production program runs at roughly $150M/year for about 1.5 kg of finished oxide. The per-gram price reflects that scarcity.",
			},
			{
				question: 'Is Pu-238 weapons-usable?',
				answer:
					'No. Pu-238 has too high a spontaneous-fission rate and decay heat to be useful as fissile weapons material — those properties are exactly what make it useful as a long-lived heat source instead. It is not subject to the same proliferation controls as Pu-239.',
			},
			{
				question: 'Where does the $5,000/g figure come from?',
				answer:
					"It's the midpoint of a $4,000–$8,000 per gram range derived from DOE/NASA program economics, the Cassini OIG report ($1,968/g in 1997 dollars, escalated to ~$3,800/g in 2024), and Atomic Insights analysis of RTG heat-source costs. /methodology has the full source list.",
			},
			{
				question: 'Is this in the downloadable dataset?',
				answer:
					'No — only commodities with a public spot market are in the /data archive (BTC, gold, silver, platinum, copper, Brent crude, wheat, coffee). Pu-238 appears on the visualisation as an illustrative reference.',
			},
		],
		relatedPages: RELATED_DEFAULT,
	},
	cocaine: {
		title: 'Bitcoin to Cocaine: How Much Cocaine Does 1 BTC Buy?',
		h1: 'Bitcoin to cocaine: how much cocaine does 1 BTC buy?',
		metaDescription:
			"Illustrative BTC-to-cocaine equivalence at the producer (~$2,500/kg), wholesale (~$30,000/kg) and retail purity-adjusted (~$120,000/kg) tiers. Composite from UNODC, DEA, and EMCDDA.",
		intro: [
			"One bitcoin currently buys roughly {ratio} at the wholesale tier (~$30,000/kg, ≥80% pure, US-standard). Cocaine has no public spot market, so the price is an illustrative composite drawn from the UNODC World Drug Report 2024, the DEA National Drug Threat Assessment 2024, and EMCDDA's European market reports. The visualisation surfaces three tiers because the same kilogram of cocaine has a wildly different price depending on where in the supply chain you sample.",
			"The three tiers and their illustrative prices: <strong>producer</strong> at the source (~$2,500/kg, range $1,500–$3,500, raw refined base, UNODC); <strong>wholesale</strong> at port-of-entry or interior distribution (~$30,000/kg, range $25,000–$35,000, ≥80% pure US standard, UNODC + DEA NDTA); <strong>retail purity-adjusted</strong> at street level normalised to 100% (~$120,000/kg, range $80,000–$250,000, DEA + EMCDDA). The wholesale tier is the headline figure because it is the most directly comparable to how the other commodities on this site are priced — standardised purity, kilogram-scale transactions.",
		],
		context: [
			'Cocaine sits in the visualisation as the high-density consumer-substance counterpart to the metals: the per-gram price is small enough that a typical retail BTC position buys an absurd amount, while a microscopic BTC position buys a kitchen-table quantity. It is rendered as a still-life with a forensic readout (mass, density, US-dollar value at the chosen tier) rather than a stacked cube because the visual idiom of a brick of compressed white powder reads more accurately than an abstract cube would.',
			'As with Pu-238, cocaine is an illustrative price and is not in the machine-readable /data archive. The tier definitions, source URLs, and as-of dates live in src/lib/illustrative-prices.json. The brand voice is dry-forensic — neither glamorising nor moralising — because the goal of the panel is to make BTC-denominated purchasing power legible, not to opine on the underlying market.',
		],
		faqs: [
			{
				question: 'How much cocaine does 1 bitcoin buy today?',
				answer:
					'About {ratio} at the illustrative wholesale tier of ~$30,000 per kilogram (≥80% pure, US standard). The visualisation also surfaces producer (~$2,500/kg) and retail purity-adjusted (~$120,000/kg) tiers.',
			},
			{
				question: 'Where do these prices come from?',
				answer:
					"Composite illustrative figures drawn from UNODC's World Drug Report 2024, the DEA National Drug Threat Assessment 2024, and EMCDDA's European market data. Full source list and uncertainty bands are at /methodology under \"Illustrative pricing → Cocaine\".",
			},
			{
				question: 'Why three tiers and not one number?',
				answer:
					"Because the same kilogram of cocaine sells for radically different prices depending on where in the supply chain you sample. Producer prices reflect the value to coca-growing communities; wholesale prices reflect bulk interdiction value; retail purity-adjusted prices reflect street-level consumer economics normalised to 100% purity for comparison.",
			},
			{
				question: 'Which tier is the headline BTC equivalence?',
				answer:
					'Wholesale (~$30,000/kg). It is the most directly comparable to how the other commodities on the site are priced: standardised purity, kilogram-scale transactions, and the tier most often cited in official market reports.',
			},
			{
				question: 'Is this in the downloadable dataset?',
				answer:
					'No — the /data archive holds only commodities with public spot markets (BTC, gold, silver, platinum, copper, Brent crude, wheat, coffee). Cocaine appears on the visualisation as an illustrative reference.',
			},
		],
		relatedPages: RELATED_DEFAULT,
	},
};
