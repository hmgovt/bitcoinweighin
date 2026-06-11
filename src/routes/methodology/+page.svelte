<script lang="ts">
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';
	const sections = [
		{ id: 'what-this-is', title: 'What this is' },
		{ id: 'data-sources', title: 'Data sources' },
		{ id: 'forward-fill', title: 'Forward-fill logic' },
		{ id: 'btc-supply', title: 'BTC supply derivation' },
		{ id: 'illustrative', title: 'Illustrative pricing' },
		{ id: 'hashweight', title: 'Hashweight: network physical mass' },
		{ id: 'cross-validation', title: 'Cross-validation' },
		{ id: 'versioning', title: 'Versioning and updates' },
		{ id: 'corrections', title: 'Corrections' },
	];
</script>

<svelte:head>
	<title>Methodology: How We Price Bitcoin in Commodities · Bitcoin Weigh-In</title>
	<meta
		name="description"
		content="Sources, forward-fill rules, BTC supply derivation, illustrative pricing for plutonium-238 and cocaine, cross-validation, versioning, and corrections for the Bitcoin Weigh-In commodity price dataset."
	/>
	<link rel="canonical" href="https://bitcoinweighin.com/methodology" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://bitcoinweighin.com/methodology" />
	<meta property="og:title" content="Methodology: How We Price Bitcoin in Commodities" />
	<meta
		property="og:description"
		content="Sources, forward-fill rules, BTC supply derivation, illustrative pricing, cross-validation, versioning and corrections."
	/>
	<meta property="og:image" content="https://bitcoinweighin.com/og-image" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${webPageJsonLd({ url: 'https://bitcoinweighin.com/methodology', name: 'Methodology — Bitcoin Weigh-In', description: 'How Bitcoin Weigh-In sources, validates, versions, and corrects its commodity price dataset.' })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: 'https://bitcoinweighin.com/' }, { name: 'Methodology', url: 'https://bitcoinweighin.com/methodology' }])}</script>`}
</svelte:head>

<div class="methodology-page">
	<main class="mx-auto max-w-3xl px-4 py-8 text-zinc-800">
		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">Methodology</h1>
			<p class="mt-2 text-sm text-zinc-600">
				How Bitcoin Weigh-In sources, validates, versions, and corrects its commodity price
				dataset. Companion to the
				<a href="/data" class="underline hover:no-underline">dataset</a>.
			</p>
		</header>

		<nav class="mb-10 border border-zinc-200 bg-zinc-50 p-4 text-sm">
			<div class="mb-2 font-semibold text-zinc-700">Contents</div>
			<ol class="list-decimal pl-5 text-zinc-700">
				{#each sections as s}
					<li><a href={`#${s.id}`} class="underline hover:no-underline">{s.title}</a></li>
				{/each}
			</ol>
		</nav>

		<section id="what-this-is" class="prose-section">
			<h2>What this is</h2>
			<p>
				The Bitcoin Weigh-In dataset records daily closing prices in US dollars for a curated set
				of fungible commodities from 2013-01-02 to the most recent completed UTC day. From those
				closes it derives per-BTC equivalents (how many troy ounces of gold, pounds of copper, or
				barrels of crude one bitcoin could have purchased on each day) and pairs them with a
				deterministically computed BTC circulating supply. The artifact is a single small file —
				around 800 KB as CSV, 700 KB as Parquet — that any analyst, journalist, or hobbyist can
				download once and analyse offline without an API key.
			</p>
			<p>
				This document describes how the data is collected, what the published flags mean, how
				cross-validation works, how versions are cut, and how to report corrections. The companion
				<a href="/data" class="underline hover:no-underline">dataset page</a> ships the artifacts;
				this page describes the rules behind them.
			</p>
		</section>

		<section id="data-sources" class="prose-section">
			<h2>Data sources</h2>
			<p>
				Two providers between them cover every series in the live dataset. Each commodity is
				pinned to a single primary endpoint so the dataset has one parser, one rate-limit regime,
				and one place to look when something disagrees with the rest of the financial press.
			</p>
			<h3>Stooq</h3>
			<p>
				The primary source for BTC and for spot and continuous-front-month futures: BTC-USD
				(<code>btcusd</code>), gold (<code>xauusd</code>), silver (<code>xagusd</code>), platinum
				(<code>xptusd</code>), copper (<code>hg.c</code>), CBOT wheat (<code>zw.c</code>), and
				ICE coffee (<code>kc.c</code>). Symbols use the <code>.c</code> suffix for continuous
				contracts rather than <code>.f</code> per Stooq's published conventions. Stooq added an
				API-key requirement after the initial bootstrap; the daily job sends the key with each
				request, and a redacted form of every fetched URL is recorded in
				<a href="/health.json" class="underline hover:no-underline">/health.json</a> so an
				authentication failure surfaces clearly rather than presenting as silent forward-fill.
			</p>
			<h3>FRED (St. Louis Fed)</h3>
			<p>
				The primary source for Brent crude (<code>DCOILBRENTEU</code>). FRED redistributes the
				EIA spot price daily, typically with a one business-day lag. The daily job retries
				transient HTTP errors on a backoff and forward-fills if the value never arrives.
			</p>
			<h3>Derived (no API)</h3>
			<p>
				BTC circulating supply is computed in <code>scripts/sources.ts</code> as a pure function
				of days-since-genesis. Genesis is 2009-01-03; the protocol targets 144 blocks per day,
				the initial block reward is 50 BTC, and the reward halves every 210,000 blocks. The
				implementation walks halving eras and accumulates supply era-by-era. Because every input
				is a constant of the protocol, the column has no API dependency and is unit-tested
				against known halving block dates.
			</p>
		</section>

		<section id="forward-fill" class="prose-section">
			<h2>Forward-fill logic</h2>
			<p>
				Markets close on weekends and public holidays. Source endpoints occasionally drop a
				single day's row even on a normal trading session. In both cases the daily job carries
				the previous known value forward so that every calendar date from coverage start to last
				update has a row in the dataset. The decision to forward-fill rather than emit nulls is
				an honest one — analyses that join across commodities need a value for every date, and
				the alternative (per-commodity NaN) silently propagates into derived calculations.
			</p>
			<p>
				v1.0 of the dataset ships a <code>forward_filled</code> column populated as empty string
				for every row, because per-row fill provenance is not reconstructable from the historical
				NDJSON that was bootstrapped before this column existed. Prospective per-row tracking
				begins in v1.1, at which point the column will hold a pipe-delimited list of the
				column names that were forward-filled on that date — for example
				<code>xpt_usd|brent_usd</code> on a typical US-market holiday where the Stooq feeds
				returned values but the FRED Brent series and Stooq XPT had not yet published.
			</p>
			<p>
				The daily cron writes a separate fill record per source into
				<a href="/health.json" class="underline hover:no-underline">/health.json</a> on every run,
				so the present day's fill state is always visible even before per-row tracking lands.
				The cron also exits non-zero if every source returns zero rows on a UTC weekday — a
				signal that authentication, rate limits, or upstream infrastructure has changed, rather
				than silent fill propagating an undetected outage.
			</p>
		</section>

		<section id="btc-supply" class="prose-section">
			<h2>BTC supply derivation</h2>
			<p>
				The <code>btc_supply</code> column is deterministic. For a date <em>D</em>:
			</p>
			<ol class="my-3 list-decimal pl-6 text-sm">
				<li>Compute days since the genesis block at 2009-01-03.</li>
				<li>Multiply by 144 (the protocol's target blocks per day) to get an approximate cumulative block count.</li>
				<li>
					Walk halving eras of 210,000 blocks: era 1 pays 50 BTC per block, era 2 pays 25, era
					3 pays 12.5, era 4 pays 6.25, era 5 pays 3.125, and so on. For each era, add
					<code>min(era_end, total_blocks) − blocks_so_far</code> times the era's reward.
				</li>
				<li>Round to an integer count of BTC.</li>
			</ol>
			<p>
				The approximation drifts a few thousand BTC from reality (real interblock times vary
				around the 10-minute target, and mining hashrate growth nudges blocks slightly faster
				than schedule), but the error is small enough — under 0.1% across the full coverage range
				— that the column is fit for the visualisation's purpose: showing where on the supply
				curve any given date sits. Analyses that need block-exact supply should pull from a node
				or a block explorer; this dataset's column is a clean closed-form schedule.
			</p>
		</section>

		<section id="illustrative" class="prose-section">
			<h2>Illustrative pricing</h2>
			<p>
				Two of the four commodities rendered in the visualisation — Plutonium-238 and cocaine —
				do not have public spot markets. Their prices on the site are illustrative composites
				constructed from named sources, with the as-of date carried alongside. They appear on the
				main visualisation but they are <strong>not</strong> in the live dataset published under
				<a href="/data" class="underline hover:no-underline">/data</a>, which holds only live
				market closes. A third commodity, the LEU uranium fuel pellet, follows the same pattern
				but is currently deferred from the visualisation; its illustrative price record persists
				in the repository for later re-enable.
			</p>
			<h3>Plutonium-238</h3>
			<p>
				Composite material-cost estimate of ~$5,000/g (midpoint of a $4,000–$8,000 range)
				derived from the DOE Office of Nuclear Energy, NASA Planetary Science Division
				publications on the Pu-238 production program (~$150M/year for ~1.5 kg/year), the Cassini
				OIG report from 1997 ($1,968/g escalated to 2024 dollars), and Atomic Insights' analysis
				of RTG heat sources. A separately cited fully-loaded program cost (~$100,000/g) reflects
				the facility maintenance and regulatory infrastructure required for production but is
				less directly comparable to other commodities' market prices, so the material-cost figure
				drives the BTC equivalence on the visualisation. Uncertainty bounds: roughly ±60% around
				the midpoint at the material-cost layer. As-of date: 2024-12-31.
			</p>
			<h3>LEU uranium fuel pellet</h3>
			<p>
				Composite cost of ~$20 per 7 g pellet from the World Nuclear Association
				"Economics of Nuclear Power" methodology, cross-checked against the IAEA/OECD-NEA Red
				Book 2024. Decomposes as: U₃O₈ feed at ~$100/lb, conversion to UF₆ at ~$20/kgU,
				enrichment at ~$150/SWU, fabrication at ~$300/kgU, yielding ~$3,000/kgU of finished
				fuel; divided by 7 g/pellet ≈ $20/pellet. Uncertainty bounds: ±30% by contract terms,
				enrichment level, and market conditions. As-of date: 2025-01-01.
			</p>
			<h3>Cocaine (three-tier)</h3>
			<p>
				There is no spot market for cocaine. The composite presents three tiers reflecting the
				market's actual structure: <strong>producer</strong> (~$2,500/kg, range $1,500–$3,500,
				raw refined base, UNODC World Drug Report 2024); <strong>wholesale</strong>
				(~$30,000/kg, range $25,000–$35,000, ≥80% pure US wholesale standard, UNODC 2024 / DEA
				NDTA 2024); and <strong>retail purity-adjusted</strong> (~$120,000/kg, range
				$80,000–$250,000, normalised to 100% for cross-tier comparison, DEA / EMCDDA). Wholesale
				is the primary tier for BTC equivalence because it is the most directly comparable to
				how other commodities are priced (standardised purity, kilogram-scale transactions).
				As-of date: 2024-12-31.
			</p>
		</section>

		<section id="hashweight" class="prose-section">
			<h2>Hashweight: network physical mass</h2>
			<p>
				The Hashweight panel estimates the total physical mass of the hardware that secures
				the Bitcoin network. It is an order-of-magnitude estimate — treat all figures as
				having roughly ±30% uncertainty — derived from three independently sourced inputs:
				live network hashrate, published ASIC specifications, and publicly disclosed node counts.
			</p>
			<h3>Live hashrate</h3>
			<p>
				Current network hashrate is fetched at page load from the
				<a href="https://mempool.space/api/v1/mining/hashrate/1w" class="underline hover:no-underline">mempool.space
				mining API</a> (<code>/api/v1/mining/hashrate/1w</code>), which returns a 7-day
				rolling average in H/s. The historical sparkline uses
				<code>/api/v1/mining/hashrate/all</code>, which provides weekly averages back to
				Bitcoin's origin. If the API is unreachable, the panel falls back to a recent
				known-good value (800 EH/s).
			</p>
			<h3>ASIC fleet model</h3>
			<p>
				The installed ASIC fleet is modelled with two blended constants:
			</p>
			<ul class="my-3 list-disc pl-6 text-sm">
				<li>
					<strong>150 TH/s per machine</strong> — a blend of S19-era hardware
					(Antminer S19 Pro: 110 TH/s, S19 XP: 140 TH/s) and S21-era hardware
					(Antminer S21: 200 TH/s, S21 Pro: 234 TH/s). Older S9-class machines
					(~100 TH/s) and early retirements pull the average down; cutting-edge
					deployments push it up.
				</li>
				<li>
					<strong>13.5 kg per machine</strong> — S19-class units average ~13.2–14.3 kg;
					S21-class units average ~14.2–14.9 kg; older hardware is lighter (~4.3 kg for
					S9). The blended fleet average lies between those bounds.
				</li>
			</ul>
			<p>
				ASIC count = hashrate (TH/s) ÷ 150. ASIC mass = ASIC count × 13.5 kg.
				At ~950 EH/s this yields ~6.3 million machines weighing ~85,000 metric tonnes.
				The model over-counts recently retired machines still in transit and under-counts
				very new hardware not yet fully deployed; ±30% is a reasonable uncertainty band.
			</p>
			<h3>Node mass</h3>
			<p>
				Full nodes contribute negligibly to the total: approximately 20,000 reachable nodes
				(source: <a href="https://bitnodes.io" class="underline hover:no-underline">bitnodes.io</a>)
				at a blended average of 0.5 kg each (Raspberry Pi at 45 g through NUC/small server
				at ~1.2 kg) ≈ 10 metric tonnes — under 0.02% of total network mass.
				The true node count including behind-NAT nodes is likely 50,000–100,000+, but
				even at that scale the contribution remains under 50 tonnes.
			</p>
			<h3>Titanic comparison</h3>
			<p>
				The comparison reference is the RMS Titanic's <em>loaded displacement</em>:
				52,310 long tons = <strong>53,150 metric tonnes</strong>. This is the actual
				physical mass of the ship, passengers, cargo, and fuel when she sailed.
				Note: the commonly cited figure of 46,328 is the ship's gross <em>register</em>
				tonnage — a volumetric measure (100 cubic feet = 1 gross ton), not a mass.
				Comparing a mass to a volume figure would be dimensionally incorrect, so the
				displacement figure is used here.
			</p>
			<h3>Solo miner estimate</h3>
			<p>
				Solo miners — predominantly
				<a href="https://github.com/skot/bitaxe" class="underline hover:no-underline">Bitaxe</a>
				open-source boards, home Antminers, and Nerdminers — are estimated at
				~40 PH/s total hashrate and ~60,000 devices. CKPool Solo routinely reports
				10–20 PH/s; allowing for other solo pools and direct-connected miners,
				30–50 PH/s is a plausible range. At ~667 GH/s average per device
				(Bitaxe Ultra/Gamma range: 400–1,200 GH/s), 40 PH/s implies ~60,000 units.
				Average device weight of 0.18 kg blends bare Bitaxe boards (~0.12 kg) with
				heavier home ASICs. Total solo mass ≈ 11 metric tonnes, representing roughly
				0.012% of total network mass.
			</p>
		</section>

		<section id="cross-validation" class="prose-section">
			<h2>Cross-validation</h2>
			<p>
				After the primary stooq and FRED fetches complete, the daily job queries a secondary
				source — Massive — for the same day's close on BTC-USD, XAU-USD, XAG-USD, and (where
				available) XPT-USD. For each ticker where both providers return a value, the job
				computes the absolute percent difference. When the difference exceeds 0.5%, an entry is
				appended to a <code>cross_validation_flags</code> array in
				<a href="/health.json" class="underline hover:no-underline">/health.json</a> recording
				the date, ticker, both values, and the percent diff.
			</p>
			<p>
				The cross-validation step is a quality signal, not a build gate. It does not fail the
				daily cron — a missing API key, an HTTP error, a parse failure, or a Massive ticker that
				doesn't exist all produce a "skipped" status without emitting a flag. This is
				deliberate: a secondary-source disagreement is information for an analyst, not an
				infrastructure outage that should block publication of the primary feed. Tickers Massive
				doesn't cover (continuous futures, FRED-only series like Brent) are skipped silently.
			</p>
		</section>

		<section id="versioning" class="prose-section">
			<h2>Versioning and updates</h2>
			<p>
				The dataset uses semantic versioning for schema changes: a major bump for removed or
				renamed columns, a minor bump for added columns or sources, and a patch for fixes that
				preserve the schema. The current version is pinned in
				<code>dataset-config.json</code> at the repository root; the artifact builder uses that
				value to decide which <code>static/data/v&lbrace;X.Y&rbrace;/</code> directory to write to. Bumping
				the version is a manual one-line edit committed by the maintainer.
			</p>
			<p>
				Daily updates happen at 02:00 UTC. A GitHub Actions cron fetches the previous UTC day's
				close from every source, appends a row to <code>data/prices.ndjson</code>, rebuilds
				<code>static/prices.json</code>, regenerates every artifact under
				<code>static/data/v&lbrace;X.Y&rbrace;/</code>, and commits the result to <code>main</code>.
				Cloudflare Pages redeploys automatically from the commit. The <em>latest</em> aliases at
				<code>/data/prices.csv</code>, <code>/data/prices.json</code>, and similar always point
				to the current version's artifacts; the versioned directory at
				<code>/data/v&lbrace;X.Y&rbrace;/</code> persists indefinitely so prior versions remain
				downloadable.
			</p>
			<p>
				Archival to Zenodo is triggered manually by cutting a GitHub release tag, at which point
				Zenodo's GitHub integration mints a DOI and archives the source tarball. The DOI is
				copied back into <code>dataset-config.json</code> and the next build surfaces it on the
				dataset page. Release cadence is keyed to schema-meaningful changes rather than the
				daily content updates, which keeps DOIs sparse and citable.
			</p>
		</section>

		<section id="corrections" class="prose-section">
			<h2>Corrections</h2>
			<p>
				To report a suspected error, email
				<a href="mailto:info@sortathing.com?subject=Dataset%20correction" class="underline hover:no-underline">info@sortathing.com</a>
				with the affected date(s) and column(s), the value the dataset shows, and where the
				corrected value should come from with a link. Corrections that affect a single row land
				in the next daily commit; corrections that affect the schema or a historical methodology
				trigger a minor version bump and a CHANGELOG entry. Either way, the original row stays in
				git history — the dataset is the current best truth, but the prior shape remains
				inspectable in the commit log.
			</p>
		</section>
	</main>
</div>

<style>
	.methodology-page :global(body) {
		background: #fafafa;
	}
	.prose-section {
		margin-bottom: 2.5rem;
	}
	.prose-section :global(h2) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e4e4e7;
		scroll-margin-top: 1rem;
	}
	.prose-section :global(h3) {
		font-size: 1rem;
		font-weight: 600;
		margin: 1rem 0 0.4rem;
		color: #3f3f46;
	}
	.prose-section :global(p) {
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0.6rem 0;
		color: #3f3f46;
	}
	.prose-section :global(code) {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.8125rem;
		background: #f4f4f5;
		padding: 0.05rem 0.25rem;
		border-radius: 2px;
	}
</style>
