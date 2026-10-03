# Reply radar

Watches 32 big X accounts (`watchlist.json`) and, when one of their posts takes
off, sends a Discord alert with a drafted reply. A person reads it and replies
from the X app. **Nothing here ever posts to X.**

## How a run works (`.github/workflows/radar.yml`, every 15 min)

1. **Sweep** (`sweep.ts`): one TwitterAPI.io search for every original post from
   the watchlist since the last run. On-topic posts wait as "pending"; once one is
   10+ minutes old its counts are re-read. If its heat clears `sweep.minHeat`, and
   the daily caps allow, it becomes a candidate with a fact sheet (`facts.ts`,
   `reference-facts.json`) and a template fallback reply (`angles.ts`).
2. **Draft** (Claude Code Action, on the Claude subscription): only when there are
   candidates. Claude follows `PROMPT.md` and `STYLE.md` and writes up to two
   options per post, or skips a post with no strong angle.
3. **Alert** (`alert.ts`): every option goes through `validate.ts`. Each number
   must come from the fact sheet or the post, or be worked out from them. Passing
   drafts go to Discord; if none pass, the template does, marked as such.

State (pending posts, alerts sent, daily counts, recent replies) is carried
between runs in the Actions cache under `.radar-state/`.

## Secrets

`TWITTERAPI_IO_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` (run `claude setup-token`
locally) and `DISCORD_WEBHOOK_URL`.

## Running it by hand

In GitHub: Actions → Reply radar → Run workflow. Tick **test** to run the whole
pipeline, Claude included, on the saved posts in `tests/fixtures/radar-posts.json`;
the alerts print in the log, and live state and Discord are left alone. Tick
**dry run** for a real sweep whose alerts print in the log instead of Discord.

Locally:

    # offline, against yesterday's posts (no API calls, no Discord)
    npx tsx scripts/radar/sweep.ts --fixture=tests/fixtures/radar-posts.json --now=2026-10-02T21:00:00Z --state=.radar-state-test/state.json
    # …write output/radar/drafts.json (or let the fallback run), then:
    npx tsx scripts/radar/alert.ts --dry --state=.radar-state-test/state.json

    # live sweep, once
    NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/sweep.ts

    # what the last N hours would have produced, and handle checks
    NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/dry-run.ts --hours=24 [--discord]
    NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/dry-run.ts --verify

## Tuning

`watchlist.json` → `sweep` (thresholds), `limits` (caps), `hours` (window).
Better replies come from `STYLE.md` (add good and bad examples from real
alerts) and from adding checked facts to `reference-facts.json`.
