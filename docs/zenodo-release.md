# Zenodo release workflow

Zenodo's GitHub integration auto-archives any GitHub release and mints a
DOI for it. This document describes how to cut a citable release of the
dataset and surface its DOI on the `/data` page. The pipeline runs no
Zenodo API calls — Zenodo watches the repo for releases and does the
work.

## One-time setup

1. Open <https://zenodo.org/account/settings/github/> and sign in with
   the GitHub account that owns this repository.
2. Find `hmgovt/bitcoinweighin` in the list and flip its toggle to **ON**.
   Zenodo installs a webhook on the repo (visible under repo
   Settings → Webhooks).
3. Confirm the webhook is live by opening the repo's webhooks page and
   checking that the most recent delivery to `zenodo.org` succeeded.

Once the toggle is on, every subsequent GitHub release on this repo
will be archived to Zenodo automatically.

## Per-release process

The release tag should be `dataset-vX.Y` where `X.Y` matches
`dataset-config.json`'s `version` field. Example: `dataset-v1.0`.

1. **Bump the version.** Edit `dataset-config.json`:
   ```json
   { "version": "1.1", ... }
   ```
   Commit with a message like `chore(data): bump dataset version to 1.1`.
   The next daily cron run will rebuild artifacts under
   `static/data/v1.1/` automatically; you can also run
   `npm run build-dataset` locally and commit the artifacts in the same
   change.
2. **Update the changelog.** Prepend a `## v1.1 — YYYY-MM-DD` section to
   `static/data/CHANGELOG.md` describing what changed since the previous
   version. Commit alongside the version bump.
3. **Push to `main`.** Wait for the build to land.
4. **Cut the GitHub release.** On the repo's Releases page, draft a new
   release with:
   - **Tag:** `dataset-v1.1` (create new tag from `main`)
   - **Title:** `Dataset v1.1 — YYYY-MM-DD`
   - **Description:** copy the CHANGELOG section, plus a one-line
     summary at the top. Do **not** attach any files manually — Zenodo
     grabs the source tarball.
   - Mark as the latest release.
5. **Publish.** Within a few minutes, Zenodo's webhook fires, creates a
   record, and mints a DOI. The DOI appears on the project's Zenodo
   page (linked from
   <https://zenodo.org/account/settings/github/>).
6. **Wire the DOI back.** Edit `dataset-config.json` again:
   ```json
   {
     "version": "1.1",
     "doi": "10.5281/zenodo.XXXXXXX",
     "zenodo_record": "XXXXXXX",
     ...
   }
   ```
   Commit with message `chore(data): set Zenodo DOI for v1.1`.
7. **Verify.** After the next deploy, the `/data` page's metadata strip
   shows the DOI, the Zenodo DOI block renders, and the citation tabs
   include the DOI. The `CITATION.cff` in the next artifact rebuild
   also includes a `doi:` line.

## Cadence

Cut a release only when something schema- or methodology-meaningful
changes. Daily price updates **do not** warrant a release — Zenodo DOIs
are valuable because they're stable and citable, and minting one per
day would dilute that.

Typical release triggers:

- New column added to the schema (minor version bump).
- New commodity source added (minor).
- Methodology change that affects historical values (minor or major
  depending on backwards-compatibility).
- Column removed or renamed (major).
- Correction to historical data large enough to invalidate prior
  citations (minor).

## Versioned DOIs

Zenodo's "concept DOI" stays the same across all releases of a
repository; each release also gets its own version-specific DOI. The
field stored in `dataset-config.json` should be the **version-specific
DOI** so that citations are pinned to the exact data they used. The
concept DOI is also fine to reference, but only in cases where the
caller deliberately wants the "latest" version of the dataset.

The Zenodo record page shows both DOIs side-by-side. The version DOI
is the one labelled with the specific release tag.

## Recovery

If a release was cut accidentally or with the wrong tag, the simplest
fix is to:

1. Delete the GitHub release (this does **not** delete the Zenodo
   archive — Zenodo deliberately won't let you remove records).
2. Note the unwanted DOI in the changelog as deprecated.
3. Cut a corrected release with the next available version number.
