# radar-trigger

A Cloudflare Worker that starts the reply radar every 15 minutes, 07:00–23:45
UTC. GitHub's own schedule for the radar is unreliable: in its first week it
ran 3 to 5 times a day instead of about 68. The Worker asks GitHub to run the
workflow (`workflow_dispatch`) on Cloudflare's clock instead. The GitHub
schedule stays in `radar.yml` as a fallback.

It needs one secret, `GH_TOKEN`. There is no way to start a run over HTTP; the
Worker only acts on its schedule.

## Set it up (about 10 minutes, once)

### 1. A GitHub token that can start the radar, and nothing else

GitHub → your profile picture → **Settings** → **Developer settings** →
**Personal access tokens** → **Fine-grained tokens** → **Generate new token**.

- **Resource owner:** hmgovt
- **Expiration:** the longest offered. Note the date: when it expires, the
  runs stop and the Worker's cron events show as failed (401).
- **Repository access:** Only select repositories → `bitcoinweighin`
- **Permissions → Repository permissions → Actions:** Read and write. Leave
  everything else as it is.

Generate it and keep the page open; it is shown once. Don't paste it anywhere
but step 2.

### 2. The Worker, in the Cloudflare dashboard

1. **Workers & Pages** → **Create** → **Create Worker** (Hello World is fine).
   Name it `radar-trigger` → **Deploy**.
2. **Edit code**: replace everything with the contents of `src/index.js` →
   **Deploy**.
3. **Settings** → **Variables and Secrets** → **Add**: type **Secret**, name
   `GH_TOKEN`, value the token from step 1 → save and deploy.
4. **Settings** → **Triggers** → **Cron Triggers** → **Add**: `*/15 7-23 * * *`.

Within 15 minutes, runs started by `workflow_dispatch` appear under the
repository's **Actions** → **Reply radar**, every quarter of an hour.

### Or with wrangler

From this folder, logged in to Cloudflare: `npx wrangler deploy`, then
`npx wrangler secret put GH_TOKEN`. The schedule comes from `wrangler.toml`.

## When the token expires

Make a new one the same way and replace the `GH_TOKEN` secret (step 2.3).
Until then the radar falls back to GitHub's unreliable schedule.
