<script lang="ts">
	import SiteHeader from '$lib/components/brand/SiteHeader.svelte';
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';
	import { MACHINES, machineKg, LIFETIME_YEARS, SMOOTH_DAYS } from '$lib/hashweight/fleet.js';
	const sections = [
		{ id: 'what-this-is', title: 'What this is' },
		{ id: 'data-sources', title: 'Data sources' },
		{ id: 'forward-fill', title: 'Forward-fill logic' },
		{ id: 'btc-supply', title: 'BTC supply derivation' },
		{ id: 'illustrative', title: 'Illustrative pricing' },
		{ id: 'visualiser', title: 'The live visualiser: camera and staging' },
		{ id: 'hashweight', title: 'Hashweight: network physical mass' },
		{ id: 'cross-validation', title: 'Cross-validation' },
		{ id: 'versioning', title: 'Versioning and updates' },
		{ id: 'corrections', title: 'Corrections' },
		{ id: 'credits', title: 'Credits and licences' },
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
		<div class="mb-6 -mt-4"><SiteHeader tone="light" current="methodology" /></div>
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
				Three providers between them cover every live series. Each commodity is
				pinned to a single primary endpoint so the dataset has one parser, one rate-limit regime,
				and one place to look when something disagrees with the rest of the financial press.
			</p>
			<h3>CoinGecko</h3>
			<p>
				The primary source for BTC-USD (coin id <code>bitcoin</code>) and for
				<a href="/btc/gold" class="underline hover:no-underline">gold</a>, priced via Pax
				Gold (<code>pax-gold</code>) — a token redeemable for one fine troy ounce of LBMA gold that
				tracks spot within a small premium. Both come from CoinGecko's keyless public API
				(<code>market_chart</code>); the daily job records the last price of each UTC day. No API key
				is required, so the shared pool is IP-throttled and the job backs off on HTTP&nbsp;429.
								</p>
				<h3>GoldAPI.io</h3>
				<p>
					The primary source for
					<a href="/btc/silver" class="underline hover:no-underline">silver</a> spot
					(<code>XAG/USD</code>, USD per troy ounce). The daily
					job sends the key in the <code>x-access-token</code> header, and
				a redacted form of every fetched URL is recorded in
				<a href="/health.json" class="underline hover:no-underline">/health.json</a> so an
				authentication failure surfaces clearly rather than presenting as silent forward-fill.
			</p>
			<h3>FRED (St. Louis Fed)</h3>
			<p>
				The primary source for Brent crude (<code>DCOILBRENTEU</code>). FRED redistributes the
				EIA spot price daily, typically with a one business-day lag. The daily job retries
				transient HTTP errors on a backoff and forward-fills if the value never arrives.
			</p>
			<h3>Stooq (retired)</h3>
				<p>
					Stooq was the original source for BTC, gold, silver, and several deferred commodities
					(platinum, copper, CBOT wheat, ICE coffee). It was dropped on 2026-06-13 after it began
					blocking automated access. BTC, gold, and silver moved to the providers above; the
					deferred commodities are not rendered in the interface and their historical values
					remain frozen in the dataset.
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
			<h3>Cash (derived, no API)</h3>
			<p>
				The <a href="/btc/cash" class="underline hover:no-underline">Cash</a> commodity has
				no price to fetch: one $1 Federal Reserve Note is worth exactly
				one dollar, so its "price" is the constant 1, and the note count is simply the live
				BTC-USD value. The only external data are fixed physical constants from the U.S. Bureau
				of Engraving and Printing — note length 155.956&nbsp;mm (6.14&nbsp;in), width
				66.294&nbsp;mm (2.61&nbsp;in), thickness 0.10922&nbsp;mm (0.0043&nbsp;in), mass
				1&nbsp;g — identical across every denomination and unchanged since the note's current
				size was adopted in 1929. These live in <code>src/lib/billStack.ts</code> and are
				cross-checked in that file's tests against the Bureau's own public trivia that a
				banded strap of 100 notes runs about 0.43&nbsp;inches thick.
			</p>
			<h3>The cash stage</h3>
			<p>
				The Cash tab draws every note at that true size, in the units cash is actually
				handled in (<code>cashParts</code> in <code>src/lib/billStack.ts</code>): a loose
				stack under 100 notes; from 100, <strong>straps</strong> of 100 under the blue
				$100 band (the American Bankers Association colour for a strap of $1s), in piles of six;
				from 1,000, <strong>bundles</strong> of ten straps, stacked roughly as a cube; from ten
				million, <strong>pallets</strong> of 1,000 bundles (10 × 10 × 10, 0.66 × 1.56 × 1.09&nbsp;m
				and one tonne of paper, on a 14&nbsp;cm wooden pallet under shrink-wrap). Past 60 pallets
				they stand as one block faced with its pallets. The count is exact: a remainder is a
				shorter last bundle or a part-loaded last pallet, never rounded up to a whole one, and
				the few notes lying loose on the floor (up to seven, curled, folded or face down) come
				out of that remainder — never an extra, and never by breaking open a whole strap or
				bundle. The note art is printed at runtime and is deliberately not a reproduction of
				genuine Federal Reserve Note artwork: Sat takes the portrait, the serials are invented,
				and the note is "weighed, not signed". The bundle and pallet arrangement is set
				dressing; the sizes, counts and mass are not.
			</p>
			<h3>The Moon ride</h3>
			<p>
				Once the notes would stack taller than a doorway, the Cash stage offers to restack them
				as one column of notes laid flat, 0.10922&nbsp;mm each (1 BTC at $84,550 is 9.2&nbsp;m),
				and to ride up it (<code>src/lib/moonRide.ts</code>). The climb is logarithmic in
				altitude, every factor of ten taking the same time, because the tallest stack spans nine
				orders of magnitude. It passes real heights: the Statue of Liberty (93&nbsp;m), the
				Eiffel Tower (330&nbsp;m) and the Burj Khalifa (828&nbsp;m), drawn as true-scale
				silhouettes around the column, then Mount Everest (8,849&nbsp;m), airliners' cruising
				height (about 11&nbsp;km), the edge of space (the Kármán line, 100&nbsp;km), the
				International Space Station (about 408&nbsp;km), the GPS satellites (20,200&nbsp;km) and
				geostationary orbit (35,786&nbsp;km). The Moon is at its average distance,
				384,400&nbsp;km, the same figure the readout's "of the way to the Moon" has always used,
				drawn with its near side there. The Earth is painted from the site's own world map, with
				the column standing at New York. In the closing side view the stack is drawn as a line
				once its true width falls under a couple of pixels, and the Earth and the Moon, drawn at
				true size, are ringed, because at that scale they are a few pixels across. The closing
				card gives the whole 21-million supply's height at today's price, and the price at which
				it reaches the Moon: about $167,595 per BTC. That figure doesn't move with the market,
				since one note is one dollar (384,400&nbsp;km ÷ 0.10922&nbsp;mm ÷ 21,000,000).
			</p>
			<h3 id="manhattan">Manhattan (land, not a commodity)</h3>
			<p>
				The Manhattan tab shows how much of Manhattan's ground a sum of bitcoin buys
				(<code>src/lib/manhattan.ts</code>). The price is the ground itself, from the most
				thorough estimate of the island's land value: Jason Barr, Fred Smith and Sayali Kulkarni,
				"What's Manhattan worth? A land values index from 1950 to 2014" (<em>Regional Science
				and Urban Economics</em>, 2018), which valued all of Manhattan's developable land at about
				$1.74&nbsp;trillion in 2014 (range $1.54–1.95&nbsp;trillion), from some 3,600 sales of
				vacant lots. That total is spread evenly over the developable land as drawn, so the share
				of the island a sum buys is simply its value over $1.74&nbsp;trillion, whatever the exact
				area. Land, not apartment prices: an apartment's price per square foot is for floor
				space stacked many storeys up, while an area on a map is ground. It is a 2014 figure, the
				latest rigorous total, so the tab is marked illustrative, like cocaine. All 21 million
				bitcoin buy the whole island's developable land once one bitcoin is worth about $82,900.
			</p>
			<p>
				The map is New York City's own open data, built once by
				<code>scripts/build-manhattan.ts</code> into a 3.6&nbsp;MB file the page loads: the
				Department of Finance's digital tax map (every tax lot), the Department of City Planning's
				PLUTO land use and shoreline-clipped borough boundary, and building footprints with
				measured roof heights (Office of Technology and Innovation). Tax-lot outlines run out over
				the rivers in places, so every lot is clipped to the shoreline first: 42.3&nbsp;km² of
				lot outlines become 32.4&nbsp;km² of dry land, once parks and open space (PLUTO land use
				9) are left out as the land-value study did — about 55% of the borough's 59&nbsp;km², close
				to the study's 60%. Your land fills lot by lot in order up the island from the Battery,
				whole lots at a time with their buildings, and the last lot part-owned as a slice from its
				southern edge; then the outer islands. A sum smaller than a lot is a true-size square on
				the most open ground of the first lot (the build finds the spot farthest from any wall).
				The cross street named in the readout is the northernmost whose land to the south the sum
				covers.
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
				<code>brent_usd</code> on a day where most feeds returned values but the FRED Brent
				series had not yet published.
			</p>
			<p>
				The daily cron writes a separate fill record per source into
				<a href="/health.json" class="underline hover:no-underline">/health.json</a> on every run,
				so the present day's fill state is always visible even before per-row tracking lands.
				The cron also exits non-zero if every source returns zero rows on a UTC weekday — a
				signal that authentication, rate limits, or upstream infrastructure has changed, rather
				than silent fill propagating an undetected outage.
			</p>
			<p>
				Forward-fill is why the
				<a href="/snapshot" class="underline hover:no-underline">year-by-year snapshots</a>
				can quote a value for every year-open and year-close: those boundary dates
				frequently fall on a weekend or holiday, and the figure shown is the last
				known close carried forward, not a trade that happened on 1 January.
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
				Two of the five commodities rendered in the visualisation —
				<a href="/btc/pu238" class="underline hover:no-underline">Plutonium-238</a> and
				<a href="/btc/cocaine" class="underline hover:no-underline">cocaine</a> —
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
			<p>
					<strong>Density and the cube.</strong> The visualiser sizes the plutonium cube from the
					oxide <em>fuel</em> — plutonium-238 dioxide (PuO₂), the ceramic form that radioisotope
					thermoelectric generators actually burn and that glows — not the pure metal. The cube
					edge is computed at PuO₂'s <em>theoretical</em> density of 11.46 g/cm³. Real sintered
					fuel pellets are deliberately pressed to roughly 80–90% of theoretical density (a
					controlled porosity that accommodates helium from alpha decay without cracking), so an
					actual pellet of the same mass occupies 10–25% more volume — a slightly larger cube — than
					the one drawn here. We render the theoretical-density cube because it is the single
					unambiguous figure; the caveat is that real fuel is a little less dense, and therefore a
					little bulkier, than the idealised block.
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
			<h3>The cocaine stage</h3>
			<p>
				The Cocaine tab draws the bought mass at true scale beside Sat, in the units it would
				actually come in (<code>src/lib/cocaine-scene.ts</code>): under a gram, <strong>lines</strong>
				of 30 mg chopped out on a mirror, each ~6 cm × 4.5 mm and, at a loose-powder bulk density
				of 0.5 g/cm³, under half a millimetre tall, with a 43 × 22 mm razor blade alongside; from
				1 g, <strong>1 g zip-lock baggies</strong> (5 × 6 cm) heaped where they fall; from 1 kg,
				<strong>pressed, taped 1 kg bricks</strong> (21 × 14 × 3.8 cm, about a hardback book,
				~0.9 g/cm³ as wrapped), in a row and then stacked five by seven, a pallet's layer; from
				1 t, <strong>shrink-wrapped pallets</strong> (1.2 × 1.0 m) of 1,000 bricks, 29 courses
				high. Past 120 pallets they stand as one warehouse block at the true pallet count. A
				trailing part-unit is drawn (a short line, a half-filled bag, a cut brick, a part-load)
				once it reaches 15% of a unit; the count above the stage carries the exact figure. The
				tape colours and the ink stamp are set dressing; sizes, counts and masses are not.
			</p>
			<h3>Impossibility lines</h3>
			<p>
				Past a certain quantity, comparing to a real-world object stops being honest — there is no
				gold bar, silver hoard, or production run of that size. Four figures mark where the readout
				switches from "here's what this looks like" to "this has never existed," and each overshoot
				is stated as a multiple computed from these figures, never a hardcoded number:
			</p>
			<ul class="my-3 list-disc pl-6 text-sm">
				<li>
					<strong>All gold ever mined:</strong> ~213,000 t (World Gold Council 2024) —
					already the largest gold quantity anchor on the site.
				</li>
				<li>
					<strong>All silver ever mined:</strong> ~1,740,000 t (USGS / The Silver Institute) —
					already the largest silver quantity anchor on the site.
				</li>
				<li>
					<strong>Global annual cocaine production:</strong> ~2,250 t/yr (UNODC 2024 estimate,
					the figure already used by the denomination and brick-stack copy above). The same
					report's newest headline number, for 2022 output, is a record ~2,757 t — sources on
					annual cocaine manufacture range roughly 2,250–2,800 t/yr depending on report vintage;
					the site keeps its previously established, more conservative figure rather than
					introducing a second, slightly different total for the same concept.
				</li>
				<li>
					<strong>Global annual Pu-238 production:</strong> the US restart at Oak Ridge has ramped
					from ~50 g/yr (2015) through ~400 g/yr (2023) toward a ~1.5 kg/yr steady-state target by
					2026 (DOE Office of Nuclear Energy / NASA Planetary Science Division). The site uses the
					1.5 kg/yr target — the higher, more conservative figure — for its "years of global
					production" framing.
				</li>
			</ul>
			<h3>Plutonium-238 decay heat</h3>
			<p>
				Pure Pu-238 metal generates ~0.567 W/g of decay heat. The visualiser depicts the oxide fuel
				(PuO₂, see "Density and the cube" above), whose effective specific power is lower —
				approximately 0.40–0.42 W/g of oxide — because RTG-grade material is not isotopically pure
				Pu-238 and because PuO₂ carries the oxygen's extra molecular weight. The readout uses the
				midpoint, 0.41 W/g of oxide, applied to the same oxide mass the cube is sized from. Source:
				DOE Office of Nuclear Energy / NASA Planetary Science Division published RTG fuel
				specifications.
			</p>
		</section>

		<section id="visualiser" class="prose-section">
			<h2>The live visualiser: camera and staging</h2>
			<p>
				The home page renders each commodity as a real-time 3D cube at true physical scale,
				beside a rigged Shiba Inu that acts as the constant scale anchor (40 cm at the shoulder).
				Because the cube spans roughly six orders of magnitude — from a sub-millimetre fleck of
				gold to a silver monolith tens of metres on a side — a single fixed shot cannot stay
				convincing across the whole range. The scene solves scale the way a photographer does:
				with the camera. The honesty rule is that every apparent size on screen derives from one
				declared camera geometry per frame, never from an artistic fudge.
			</p>
			<p>Scale reference: Sat, Shiba Inu, 40 cm at the shoulder, 9 kg. Constant.</p>
			<h3>Camera model</h3>
			<p>
				A single perspective camera (35° field of view) frames the scene, and exactly one
				geometry is in force at any instant. As the cube grows the camera dollies along a banded
				path — macro framing for the speck (the cube held at a fixed fraction of the frame so it
				never vanishes, with a 5 cm floor), the familiar two-shot when cube and dog are
				comparable, and a wide shot when the cube towers. The transitions are continuous at the
				band crossovers by construction, and the camera's height is capped at one metre so the
				largest cubes are genuinely <em>looked up at</em> rather than viewed from above. The
				damped easing between framings is itself the scale cue: the longer the camera travels,
				the bigger the change in size you are being shown.
			</p>
			<h3>Staging honesty</h3>
			<p>
				Once the cube grows past about 1.2 m on a side, the Shiba walks to a fixed mark in the
				near foreground while the cube recedes into the distance — the standard photographer's
				trick for conveying the size of something enormous. This means the dog and the cube are
				no longer the same distance from the camera, so their on-screen sizes are governed by
				real perspective (an object twice as far away appears half as large) rather than by a
				shared scale factor. That is a true depiction, not a trick of the eye, but because it
				differs from the simple side-by-side comparison the readout says so explicitly —
				<em>"Sat is standing nearer the camera"</em> — whenever the dog is staged in the
				foreground. Nothing on screen is ever resized by feel; the apparent sizes always follow
				from the one declared camera geometry.
			</p>
			<h3>The drop</h3>
			<p>
				While you hold the slider, or drag the cube itself, the camera stays where it is and the
				cube grows or shrinks in place — it is allowed to outgrow the shot rather than being
				quietly re-framed. When you let go, the camera steps back to its proper framing and the
				cube is dropped <em>from its own height</em> (its underside one edge-length above the
				floor) under standard gravity, 9.80665 m/s², in real time. Nothing about the fall is
				slowed down or sped up, which makes the fall time a scale cue in its own right: a speck
				lands in milliseconds, the whole supply of gold takes more than a second. The readout
				states the fall time and the impact energy, <em>m·g·h</em>; where that exceeds a gram of
				TNT it also gives the TNT equivalent, using the standard convention of 4.184 GJ per tonne.
				The camera shake, the dust and Sat's reaction are all driven by that one impact-energy
				figure; none of them is tuned per amount.
			</p>
			<p>
				The same line gives the cube's resting bearing pressure — its weight over its own
				footprint, which for a cube reduces to <em>density × g × edge</em> — and compares it
				with the presumptive load-bearing values in the International Building Code (Table
				1806.2): 1,500 psf for clay, 2,000 for sand, 3,000 for gravel, 4,000 for sedimentary
				rock and 12,000 for crystalline bedrock. Past the bedrock value the floor is drawn
				cracked. These are <em>allowable</em> pressures, which include the code's safety margin,
				so exceeding one means a structural engineer would not sign it off, not that the ground
				would necessarily give way. A gold cube reaches the bedrock value at about 3.03 m on a
				side, whatever the gold price.
			</p>
			<h3>The sound</h3>
			<p>
				With the sound on, you hear the landing, and a block landing flat on a concrete floor is
				heard mostly through the floor. The blow is modelled as a mass on a spring: the cube's
				mass against the stiffness of its flat face pressed into the concrete (a flat punch on
				an elastic half-space, in series with the cube's own stiffness). So it lasts
				<em>τ = π√(m/k)</em> and delivers the cube's momentum, <em>m·v·(1 + e)</em>. The
				concrete follows ACI 318: <em>E = 4,700√f′c</em> MPa at f′c = 30 MPa, about 25.7 GPa,
				with Poisson's ratio 0.2 (Eurocode 2). Mass grows with the cube of the size and stiffness
				only in proportion to it, so the blow lengthens in step with the edge: about 0.09 ms for 1
				BTC of gold, 0.7 ms for 500 BTC, 26 ms for the whole supply. That is why small cubes tick
				and big ones thud. The peak force is startling: about a tonne for 1 BTC dropped 3 cm, and
				about 190 tonnes for 500 BTC.
			</p>
			<p>
				What you hear is that force pulse radiated by the floor slab, taken as 15 cm of concrete.
				A point force on a plate, below the plate's coincidence frequency, radiates a pressure
				that follows the force itself (Cremer, Heckl &amp; Petersson, <em>Structure-Borne
				Sound</em>). On top of that comes a sharper crack from the cube itself stopping dead,
				which dominates for small cubes. Past the building code's bedrock allowance, where the
				floor is drawn cracked, a burst of fracture clicks is added; their timing and texture
				are illustrative, and only whether the floor cracks is computed. The whole thing plays in
				a stated room: a large, hard-floored studio with a 1.4-second reverberation time.
			</p>
			<p>
				The cube's own ring is left out on purpose. We computed its free-vibration modes with the
				Rayleigh–Ritz method used in resonant ultrasound spectroscopy (Visscher et al.,
				<em>J. Acoust. Soc. Am.</em> 90, 1991), checked against beam theory and against Lamé's
				exact solution for a cube. Its loudest note is the shear wave speed divided by (√2 ×
				edge): 27 kHz for 1 BTC of gold. But even undamped, the ring carries under a
				three-hundredth of the thud's acoustic energy for a 500 BTC cube, and a block pressed flat
				on concrete loses it into the floor within a few cycles. The wave speeds used are 3,240
				and 1,200 m/s for gold and 3,650 and 1,610 m/s for silver (CRC Handbook of Chemistry and
				Physics); for plutonium dioxide they come from the measured shear modulus of 89 GPa and
				Poisson's ratio of 0.32 (Kato &amp; Matsumoto, IAEA INIS). That abstract's own Young's
				modulus, 219 GPa, is 7% lower than those two imply, which would change the blow by less
				than half a percent.
			</p>
			<p>
				Loudness is compressed from the impact energy. A real whole-supply landing would be
				deafening, and most of its energy is too low for a phone speaker to play; you would feel
				it more than hear it. Sound is off unless you switch it on; the clip recorder always
				includes it.
			</p>
			<h3>Camera optics</h3>
			<p>
				The stage camera is modelled as a real one: a full-frame sensor (24 mm tall) with the
				focal length its 35° field of view implies (about 38 mm), at f/2.8, focused on the cube.
				Every pixel is blurred by that lens's thin-lens circle of confusion for its distance,
				<em>c = A·f·|d − S| / (d·(S − f))</em>. That is why small amounts come out looking like
				macro photographs, with Sat's paws soft behind a sharp speck of metal, and large amounts
				come out sharp from front to back: a real camera at 20 cm and at 25 m behaves exactly that
				way, and it is the same cue that makes tilt-shift photos of cities look like toys. The
				blur is capped at 5% of the frame height for legibility, so it is only ever understated;
				at the closest framings a real lens would blur the background more. No atmospheric haze
				is added: over the distances in the scene (under about 100 m) real air adds none.
			</p>
			<h3>The magnifier</h3>
			<p>
				Below about eight pixels on screen the cube cannot be resolved at all, so a circular
				magnifier appears. It re-renders the scene from the same camera position through a
				narrower field of view — a true optical magnification, like a loupe or a telephoto lens —
				and states its power, chosen from a fixed ladder (×2, ×5, ×10 … ×10,000) so that the
				magnified cube reads at a legible size. One satoshi of gold, about 68 µm on a side,
				appears at ×200 on a typical screen.
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
			<p>
				To see what one of those machines does inside, the
				<a href="/mining" class="underline hover:no-underline">Inside a Bitcoin miner</a> page takes a mining
				chip apart and simulates a single SHA-256 hash core on real block headers.
			</p>
			<h3>Live hashrate</h3>
			<p>
				Current network hashrate is fetched at page load from the
				<a href="https://mempool.space/api/v1/mining/hashrate/1w" class="underline hover:no-underline">mempool.space
				mining API</a> (<code>/api/v1/mining/hashrate/1w</code>), which returns a 7-day
				rolling average in H/s. The fleet model and its timeline use
				<code>/api/v1/mining/hashrate/all</code>, which provides weekly averages back to
				Bitcoin's origin (the panel starts in 2014). If the history is unreachable, the panel
				shows today only, from the fixed fleet average described at the end of this section;
				if the live figure is unreachable too, it falls back to 800 EH/s.
			</p>
			<h3>ASIC fleet model</h3>
			<p>
				Hashrate alone doesn't give a weight: one exahash per second took about 870,000
				machines in 2015 and about 3,700 in 2026. So the panel models the fleet in cohorts
				(<code>src/lib/hashweight/fleet.ts</code>):
			</p>
			<ol class="my-3 list-decimal pl-6 text-sm">
				<li>
					<strong>Capacity.</strong> Installed capacity is the running maximum of the
					{SMOOTH_DAYS}-day mean hashrate. Machines switched off during a dip still exist and
					still weigh: when the 2021 China ban halved the hashrate for months, the machines were
					in transit, not destroyed.
				</li>
				<li>
					<strong>Arrivals.</strong> Every rise in capacity is built from the most efficient
					machine on sale at the time (the frontier, below).
				</li>
				<li>
					<strong>Retirement.</strong> Each cohort runs for {LIFETIME_YEARS} years, then is
					replaced, like for like in hashrate, by that day's frontier machine.
				</li>
			</ol>
			<p>
				The frontier is Bitmain's Antminer line, the most-deployed family. Weights include the
				separate power supply the S5–S9 generation needed; later models have it built in.
			</p>
			<div class="my-3 overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead>
						<tr class="border-b border-zinc-300">
							<th class="py-1 pr-3">Machine</th>
							<th class="py-1 pr-3">From</th>
							<th class="py-1 pr-3">TH/s</th>
							<th class="py-1 pr-3">kg (with supply)</th>
							<th class="py-1">Source</th>
						</tr>
					</thead>
					<tbody>
						{#each MACHINES as m (m.id)}
							<tr class="border-b border-zinc-100 align-top">
								<td class="py-1 pr-3 whitespace-nowrap">{m.name}</td>
								<td class="py-1 pr-3 whitespace-nowrap">{m.from}</td>
								<td class="py-1 pr-3">{m.ths}</td>
								<td class="py-1 pr-3">{machineKg(m).toFixed(1)}</td>
								<td class="py-1 text-zinc-600">{m.source}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p>
				Before the S5 shipped (December 2014) the model still uses it, though earlier ASICs
				were heavier per TH/s, so figures for 2014 are a lower bound. Other makers (MicroBT,
				Canaan), fleets that lag the frontier and slower retirements all move the answer, so
				treat every figure as ±30%. In September 2026 the model gives roughly 5–6 million
				machines and 80,000–90,000 tonnes.
			</p>
			<h3>The pile</h3>
			<p>
				The scene stacks every machine case edge to edge (plus the S5–S9 era's separate supplies)
				into one cube and draws it in true-scale side elevation beside a 1.75 m person, a 40-ft
				ISO shipping container (12.19 × 2.59 m) and RMS Titanic, keel to funnel tops (269 m long,
				53 m tall, out of the water). Close up, the cube's face shows the front of one machine
				per cell. "Per bitcoin in existence" divides the fleet's mass by the supply at that
				date, interpolated between halvings.
			</p>
			<h3>Without the history</h3>
			<p>
				If the history can't be fetched, today's figure falls back to two blended constants:
				150 TH/s and 13.5 kg per machine (an S19/S21 mix). That is within the ±30% band of the
				cohort model.
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
				After the primary CoinGecko, GoldAPI.io, and FRED fetches complete, the daily job queries a secondary
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

		<section id="credits" class="prose-section">
			<h2>Credits and licences</h2>
			<p>
				The dataset itself is published under
				<a
					href="https://creativecommons.org/licenses/by/4.0/"
					class="underline hover:no-underline">Creative Commons CC-BY-4.0</a
				>; see the <a href="/data" class="underline hover:no-underline">dataset page</a> for
				citation details.
			</p>
			<h3>Shiba Inu 3D model</h3>
			<p>
				The Shiba Inu used as the live visualiser's scale reference is a third-party model
				licensed under CC-BY-4.0, which requires visible attribution. Per the licence:
			</p>
			<blockquote class="credit">
				This work is based on "Animated Dog, Shiba Inu"
				(<a
					href="https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474"
					class="underline hover:no-underline"
					>https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474</a
				>) by quander (<a href="https://sketchfab.com/quander" class="underline hover:no-underline"
					>https://sketchfab.com/quander</a
				>) licensed under CC-BY-4.0 (<a
					href="http://creativecommons.org/licenses/by/4.0/"
					class="underline hover:no-underline">http://creativecommons.org/licenses/by/4.0/</a
				>)
			</blockquote>
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
	.prose-section :global(blockquote.credit) {
		margin: 0.75rem 0;
		padding: 0.75rem 1rem;
		border-left: 3px solid #d4d4d8;
		background: #f4f4f5;
		font-size: 0.875rem;
		line-height: 1.55;
		color: #3f3f46;
		word-break: break-word;
	}
	.prose-section :global(code) {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.8125rem;
		background: #f4f4f5;
		padding: 0.05rem 0.25rem;
		border-radius: 2px;
	}
</style>
