/**
 * .zenodo.json is the metadata Zenodo files with each GitHub release
 * (docs/zenodo-release.md). Without it Zenodo would archive the release as
 * "software", titled after the repo and credited to the GitHub account, and
 * Zenodo records can't be deleted. These tests keep it describing the
 * dataset as dataset-config.json does, so a version bump can't ship a
 * release whose record names the previous version.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const zenodo = JSON.parse(readFileSync('.zenodo.json', 'utf-8'));
const config = JSON.parse(readFileSync('dataset-config.json', 'utf-8'));

describe('.zenodo.json vs dataset-config.json', () => {
	it('archives a dataset, open, under the same licence', () => {
		expect(zenodo.upload_type).toBe('dataset');
		expect(zenodo.access_right).toBe('open');
		expect(zenodo.license).toBe(config.license.toLowerCase());
	});

	it('carries the same title, version, abstract and authors', () => {
		expect(zenodo.title).toBe(config.title);
		expect(zenodo.version).toBe(config.version);
		expect(zenodo.description).toContain(config.abstract);
		expect(zenodo.creators.map((c: { name: string }) => c.name)).toEqual(
			config.authors.map((a: { name: string }) => a.name)
		);
	});

	it('points readers at this version’s data directory', () => {
		expect(zenodo.description).toContain(`static/data/v${config.version}/`);
	});
});
