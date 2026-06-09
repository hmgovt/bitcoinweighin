/**
 * JSON-LD builders for SEO.
 *
 * Returns strings ready to inline inside <script type="application/ld+json">
 * via {@html ...}. Schema.org types follow Google's structured-data guidance
 * (Dataset for /data so the dataset shows in Google Dataset Search; WebSite
 * + SearchAction + Organization sitewide; BreadcrumbList for hierarchy;
 * FAQPage where Q&A blocks are visible on the page).
 */

const SITE_URL = 'https://bitcoinweighin.com';
const SITE_NAME = 'Bitcoin Weigh-In';

function stringify(obj: unknown): string {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function organizationJsonLd(): string {
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${SITE_URL}/#organization`,
		name: SITE_NAME,
		url: SITE_URL,
		logo: `${SITE_URL}/header@1x.webp`,
		email: 'info@sortathing.com',
		sameAs: ['https://github.com/hmgovt/bitcoinweighin'],
	});
}

export function websiteJsonLd(): string {
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		name: SITE_NAME,
		alternateName: 'BTC Weigh-In',
		url: SITE_URL,
		description:
			"Bitcoin's purchasing power visualised in physical commodities — gold, silver, plutonium-238 and more — at true relative scale, every day since 2013.",
		publisher: { '@id': `${SITE_URL}/#organization` },
	});
}

export interface BreadcrumbItem {
	name: string;
	url: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): string {
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: item.name,
			item: item.url,
		})),
	});
}

export interface FaqEntry {
	question: string;
	answer: string;
}

export function faqJsonLd(entries: FaqEntry[]): string {
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: entries.map((e) => ({
			'@type': 'Question',
			name: e.question,
			acceptedAnswer: { '@type': 'Answer', text: e.answer },
		})),
	});
}

export interface DatasetParams {
	name: string;
	description: string;
	version: string;
	license: string;
	url: string;
	temporalCoverage: string; // e.g. "2013-01-02/2026-06-08"
	dateModified: string; // ISO date
	identifier?: string; // DOI URL when available
	creatorName: string;
	keywords?: string[];
	distributions: Array<{ encodingFormat: string; contentUrl: string }>;
}

export function datasetJsonLd(p: DatasetParams): string {
	const licenseMap: Record<string, string> = {
		'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
	};
	const licenseUrl = licenseMap[p.license] ?? p.license;
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: p.name,
		description: p.description,
		url: p.url,
		license: licenseUrl,
		version: p.version,
		temporalCoverage: p.temporalCoverage,
		dateModified: p.dateModified,
		isAccessibleForFree: true,
		...(p.identifier ? { identifier: p.identifier } : {}),
		...(p.keywords ? { keywords: p.keywords } : {}),
		creator: {
			'@type': 'Organization',
			name: p.creatorName,
			url: SITE_URL,
		},
		publisher: { '@id': `${SITE_URL}/#organization` },
		distribution: p.distributions.map((d) => ({
			'@type': 'DataDownload',
			encodingFormat: d.encodingFormat,
			contentUrl: d.contentUrl,
		})),
	});
}

export interface WebPageParams {
	url: string;
	name: string;
	description: string;
	inLanguage?: string;
}

export function webPageJsonLd(p: WebPageParams): string {
	return stringify({
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		'@id': `${p.url}#webpage`,
		url: p.url,
		name: p.name,
		description: p.description,
		inLanguage: p.inLanguage ?? 'en',
		isPartOf: { '@id': `${SITE_URL}/#website` },
	});
}
