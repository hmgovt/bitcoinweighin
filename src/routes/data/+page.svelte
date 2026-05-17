<script lang="ts">
	let { data } = $props();

	let previewTab = $state<'first' | 'last'>('first');
	let citationTab = $state<'plain' | 'bibtex' | 'apa'>('plain');
	let copiedLabel = $state<string | null>(null);

	const year = new Date(data.meta.last_updated).getUTCFullYear();
	const dateReleased = data.meta.last_updated.slice(0, 10);
	const doiSuffix = data.config.doi ? ` https://doi.org/${data.config.doi}` : '';

	const citations = {
		plain:
			`Bitcoin Weigh-In (${year}). ${data.config.title} ` +
			`(Version ${data.config.version}) [Data set]. ` +
			`Retrieved from ${data.config.homepage}.${doiSuffix}`,
		bibtex: [
			`@dataset{bitcoinweighin_${year}_v${data.config.version.replace('.', '_')},`,
			`  author    = {Bitcoin Weigh-In},`,
			`  title     = {${data.config.title}},`,
			`  version   = {${data.config.version}},`,
			`  year      = {${year}},`,
			`  url       = {${data.config.homepage}},`,
			`  license   = {${data.config.license}},`,
			...(data.config.doi ? [`  doi       = {${data.config.doi}}`] : []),
			`}`,
		].join('\n'),
		apa:
			`Bitcoin Weigh-In. (${year}). ${data.config.title} ` +
			`(Version ${data.config.version}) [Data set]. ${data.config.homepage}` +
			(data.config.doi ? `. https://doi.org/${data.config.doi}` : ''),
	};

	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedLabel = label;
			setTimeout(() => {
				if (copiedLabel === label) copiedLabel = null;
			}, 1800);
		} catch {
			// no-op; the textarea fallback below is hidden but selectable
		}
	}

	const apiExamples = {
		curl: `curl https://bitcoinweighin.com/api/prices.json`,
		python: `import requests
r = requests.get("https://bitcoinweighin.com/api/prices.json")
prices = r.json()`,
		javascript: `const res = await fetch("https://bitcoinweighin.com/api/prices.json");
const prices = await res.json();`,
	};
</script>

<svelte:head>
	<title>Bitcoin Weigh-In Dataset</title>
	<meta
		name="description"
		content="Daily commodity prices denominated in Bitcoin, 2013-present. CC-BY-4.0. Updated daily at 02:00 UTC."
	/>
	<link rel="canonical" href="https://bitcoinweighin.com/data" />
</svelte:head>

<div class="dataset-page">
	<main class="mx-auto max-w-5xl px-4 py-8 text-zinc-800">
		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">Bitcoin Weigh-In Dataset</h1>
			<p class="mt-2 text-sm text-zinc-600">
				Daily commodity prices denominated in Bitcoin, 2013-present.
				<a href="https://creativecommons.org/licenses/by/4.0/" class="underline hover:no-underline"
					>CC-BY-4.0</a
				>. Updated daily at 02:00 UTC.
			</p>
			<dl
				class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 md:grid-cols-6"
			>
				<div>
					<dt class="text-zinc-500">Version</dt>
					<dd class="font-mono">v{data.config.version}</dd>
				</div>
				<div>
					<dt class="text-zinc-500">Last updated (UTC)</dt>
					<dd class="font-mono">{data.meta.last_updated.slice(0, 19).replace('T', ' ')}</dd>
				</div>
				<div>
					<dt class="text-zinc-500">Rows</dt>
					<dd class="font-mono">{data.meta.row_count.toLocaleString()}</dd>
				</div>
				<div>
					<dt class="text-zinc-500">Coverage</dt>
					<dd class="font-mono">
						{data.meta.coverage.first_date} → {data.meta.coverage.last_date}
					</dd>
				</div>
				<div>
					<dt class="text-zinc-500">License</dt>
					<dd class="font-mono">{data.config.license}</dd>
				</div>
				<div>
					<dt class="text-zinc-500">DOI</dt>
					<dd class="font-mono">
						{#if data.config.doi}
							<a
								href={`https://doi.org/${data.config.doi}`}
								class="underline hover:no-underline">{data.config.doi}</a
							>
						{:else}
							<span class="text-zinc-400">(pending Zenodo release)</span>
						{/if}
					</dd>
				</div>
			</dl>
		</header>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Downloads</h2>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr class="border-b border-zinc-300 text-left">
							<th class="py-2 pr-4 font-medium text-zinc-600">Format</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">File</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Size</th>
							<th class="py-2 font-medium text-zinc-600">SHA-256</th>
						</tr>
					</thead>
					<tbody>
						{#each data.formats as f}
							<tr class="border-b border-zinc-100">
								<td class="py-2 pr-4">{f.format}</td>
								<td class="py-2 pr-4 font-mono">
									<a href={f.downloadHref} class="underline hover:no-underline">{f.filename}</a
									>
								</td>
								<td class="py-2 pr-4 font-mono text-zinc-600">{f.size}</td>
								<td class="py-2">
									<details class="inline">
										<summary class="cursor-pointer font-mono text-xs text-zinc-600"
											>{f.sha256.slice(0, 12)}…</summary
										>
										<code class="ml-2 break-all text-xs">{f.sha256}</code>
									</details>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-2 text-xs text-zinc-500">
				All sums also published in
				<a
					href={`/data/v${data.config.version}/SHA256SUMS`}
					class="font-mono underline hover:no-underline">SHA256SUMS</a
				>. Verify with <code class="font-mono">shasum -a 256 -c SHA256SUMS</code>.
			</p>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Sample preview</h2>
			<div class="mb-2 flex gap-2 text-xs">
				<button
					type="button"
					class="border px-3 py-1 {previewTab === 'first'
						? 'border-zinc-400 bg-zinc-100'
						: 'border-zinc-200 bg-white hover:bg-zinc-50'}"
					onclick={() => (previewTab = 'first')}>First 5 rows</button
				>
				<button
					type="button"
					class="border px-3 py-1 {previewTab === 'last'
						? 'border-zinc-400 bg-zinc-100'
						: 'border-zinc-200 bg-white hover:bg-zinc-50'}"
					onclick={() => (previewTab = 'last')}>Last 5 rows</button
				>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse font-mono text-xs">
					<thead class="sticky top-0 bg-white">
						<tr class="border-b border-zinc-300 text-left">
							{#each data.schema.columns as col}
								<th class="whitespace-nowrap px-2 py-2 font-medium text-zinc-600">{col.name}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each previewTab === 'first' ? data.first5 : data.last5 as row}
							<tr class="border-b border-zinc-100">
								{#each data.schema.columns as col}
									<td class="whitespace-nowrap px-2 py-1.5">{row[col.name] ?? ''}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Schema</h2>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr class="border-b border-zinc-300 text-left">
							<th class="py-2 pr-4 font-medium text-zinc-600">Name</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Type</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Unit</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Source</th>
							<th class="py-2 font-medium text-zinc-600">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each data.schema.columns as col}
							<tr class="border-b border-zinc-100 align-top">
								<td class="py-2 pr-4 font-mono">{col.name}</td>
								<td class="py-2 pr-4 font-mono text-zinc-600">{col.type}</td>
								<td class="py-2 pr-4 text-zinc-600">{col.unit}</td>
								<td class="py-2 pr-4 text-zinc-600">{col.source}</td>
								<td class="py-2 text-zinc-600">{col.notes}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Provenance</h2>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr class="border-b border-zinc-300 text-left">
							<th class="py-2 pr-4 font-medium text-zinc-600">Commodity</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Original source</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Quality</th>
							<th class="py-2 pr-4 font-medium text-zinc-600">Cadence</th>
							<th class="py-2 font-medium text-zinc-600">Underlying licence</th>
						</tr>
					</thead>
					<tbody>
						{#each data.provenance as p}
							<tr class="border-b border-zinc-100 align-top">
								<td class="py-2 pr-4">
									<div class="font-medium">{p.commodity}</div>
									<div class="font-mono text-xs text-zinc-500">{p.ticker}</div>
								</td>
								<td class="py-2 pr-4 text-zinc-600">
									<a href={p.sourceUrl} class="underline hover:no-underline">{p.originalSource}</a>
								</td>
								<td class="py-2 pr-4 font-mono text-xs text-zinc-600">{p.dataQuality}</td>
								<td class="py-2 pr-4 text-xs text-zinc-600">{p.updateCadence}</td>
								<td class="py-2 text-xs text-zinc-600">{p.licenseOfUnderlyingSource}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Citation</h2>
			<div class="mb-2 flex gap-2 text-xs">
				<button
					type="button"
					class="border px-3 py-1 {citationTab === 'plain'
						? 'border-zinc-400 bg-zinc-100'
						: 'border-zinc-200 bg-white hover:bg-zinc-50'}"
					onclick={() => (citationTab = 'plain')}>Plain text</button
				>
				<button
					type="button"
					class="border px-3 py-1 {citationTab === 'bibtex'
						? 'border-zinc-400 bg-zinc-100'
						: 'border-zinc-200 bg-white hover:bg-zinc-50'}"
					onclick={() => (citationTab = 'bibtex')}>BibTeX</button
				>
				<button
					type="button"
					class="border px-3 py-1 {citationTab === 'apa'
						? 'border-zinc-400 bg-zinc-100'
						: 'border-zinc-200 bg-white hover:bg-zinc-50'}"
					onclick={() => (citationTab = 'apa')}>APA</button
				>
			</div>
			<div class="relative">
				<pre
					class="overflow-x-auto whitespace-pre-wrap break-words border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">{citations[
						citationTab
					]}</pre>
				<button
					type="button"
					class="absolute right-2 top-2 border border-zinc-200 bg-white px-2 py-0.5 text-xs hover:bg-zinc-50"
					onclick={() => copy(citations[citationTab], citationTab)}
				>
					{copiedLabel === citationTab ? 'Copied' : 'Copy'}
				</button>
			</div>
			<p class="mt-2 text-xs text-zinc-500">
				Citation File Format also available at
				<a
					href={`/data/v${data.config.version}/CITATION.cff`}
					class="font-mono underline hover:no-underline">CITATION.cff</a
				>.
			</p>
		</section>

		{#if data.config.doi}
			<section class="mb-10 border border-zinc-200 bg-zinc-50 p-4">
				<h2 class="text-sm font-semibold">Cite via Zenodo DOI</h2>
				<p class="mt-1 font-mono text-sm">
					<a
						href={`https://doi.org/${data.config.doi}`}
						class="underline hover:no-underline">{data.config.doi}</a
					>
				</p>
				<p class="mt-1 text-xs text-zinc-500">
					Archived at <a
						href={`https://zenodo.org/record/${data.config.zenodo_record}`}
						class="underline hover:no-underline">zenodo.org</a
					>.
				</p>
			</section>
		{/if}

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">API access</h2>
			<p class="mb-3 text-sm text-zinc-600">
				The current keyed-by-date JSON is also served at <code
					class="font-mono text-xs">/api/prices.json</code
				> with permissive CORS, suitable for use from any browser-based notebook or third-party tool.
				Cache window: 5 minutes.
			</p>
			{#each [{ label: 'curl', code: apiExamples.curl, id: 'curl' }, { label: 'Python', code: apiExamples.python, id: 'python' }, { label: 'JavaScript', code: apiExamples.javascript, id: 'javascript' }] as ex}
				<div class="mb-3">
					<div class="mb-1 text-xs text-zinc-500">{ex.label}</div>
					<div class="relative">
						<pre
							class="overflow-x-auto border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">{ex.code}</pre>
						<button
							type="button"
							class="absolute right-2 top-2 border border-zinc-200 bg-white px-2 py-0.5 text-xs hover:bg-zinc-50"
							onclick={() => copy(ex.code, `api-${ex.id}`)}
						>
							{copiedLabel === `api-${ex.id}` ? 'Copied' : 'Copy'}
						</button>
					</div>
				</div>
			{/each}
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Versions and changelog</h2>
			<div class="changelog text-sm">{@html data.changelogHtml}</div>
			<p class="mt-3 text-xs text-zinc-500">
				Historical versions remain downloadable under
				<span class="font-mono">/data/v{data.config.version}/</span>
				and any prior version directories.
			</p>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">Known limitations</h2>
			<div class="space-y-3 text-sm text-zinc-700">
				<p>
					Commodity values are forward-filled on market-closed days (weekends,
					public holidays, and source outages). v1.0 ships a <code
						class="font-mono text-xs">forward_filled</code
					> column populated as empty string for every row because per-row fill provenance is not
					reconstructable from the existing historical data; prospective per-row tracking begins
					in v1.1.
				</p>
				<p>
					Pricing for Plutonium-238 and cocaine on the main visualisation is
					illustrative — engineering composites described on the
					<a href="/methodology" class="underline hover:no-underline">methodology page</a> — and
					is not included in this dataset, which holds only live market closes.
				</p>
				<p>
					Pre-2013 data is unavailable across the commodity set at acceptable
					quality, so coverage begins 2013-01-01. Source outages and
					cross-validation flags from the secondary feed are logged at
					<a href={data.buildStatusUrl} class="font-mono underline hover:no-underline"
						>/health.json</a
					>.
				</p>
			</div>
		</section>

		<section class="mb-10">
			<h2 class="mb-3 text-base font-semibold">License</h2>
			<p class="text-sm text-zinc-700">
				You can use this dataset for anything — commercial, academic,
				derivative — as long as you credit Bitcoin Weigh-In as the source.
				Distributed under
				<a
					href="https://creativecommons.org/licenses/by/4.0/"
					class="underline hover:no-underline">Creative Commons Attribution 4.0 International</a
				>. Full text at
				<a
					href={`/data/v${data.config.version}/LICENSE.txt`}
					class="font-mono underline hover:no-underline">LICENSE.txt</a
				>.
			</p>
		</section>

		<footer class="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
			<div class="flex flex-wrap gap-x-6 gap-y-2">
				<div>
					Maintainer:
					<a
						href="mailto:{data.config.authors[0].email}"
						class="underline hover:no-underline">{data.config.authors[0].email}</a
					>
				</div>
				<div>
					Source code:
					<a href={data.config.repository} class="underline hover:no-underline">GitHub</a>
				</div>
				<div>
					Build status:
					<a href={data.buildStatusUrl} class="font-mono underline hover:no-underline"
						>/health.json</a
					>
				</div>
				{#if data.config.doi}
					<div>
						DOI:
						<a
							href={`https://doi.org/${data.config.doi}`}
							class="font-mono underline hover:no-underline">{data.config.doi}</a
						>
					</div>
				{/if}
				<div>
					Corrections:
					<a
						href="mailto:{data.config.authors[0].email}?subject=Dataset%20correction"
						class="underline hover:no-underline">email</a
					>
				</div>
			</div>
			<div class="mt-3">
				Generated {dateReleased}. Methodology in detail at
				<a href="/methodology" class="underline hover:no-underline">/methodology</a>.
			</div>
		</footer>
	</main>
</div>

<style>
	.dataset-page :global(body) {
		background: #fafafa;
	}
	.changelog :global(h1) {
		font-size: 1rem;
		font-weight: 600;
		margin: 1.25rem 0 0.5rem;
	}
	.changelog :global(h2) {
		font-size: 0.9375rem;
		font-weight: 600;
		margin: 1rem 0 0.4rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e4e4e7;
	}
	.changelog :global(h2:first-of-type) {
		border-top: 0;
		padding-top: 0;
	}
	.changelog :global(h3) {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0.75rem 0 0.4rem;
	}
	.changelog :global(p) {
		margin: 0.4rem 0;
		color: #3f3f46;
	}
	.changelog :global(ul) {
		margin: 0.4rem 0 0.4rem 1.25rem;
		list-style: disc;
	}
	.changelog :global(li) {
		margin: 0.2rem 0;
		color: #3f3f46;
	}
	.changelog :global(code) {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.8125rem;
		background: #f4f4f5;
		padding: 0.05rem 0.25rem;
		border-radius: 2px;
	}
</style>
