# Daily X slates

One file per day (`<date>.ts`), built the evening before from the launch-week
calendar and the recurring series, on the shared machinery in `lib.ts`.

Every night, after the 02:00 UTC price update and the deploy that rebuilds the
link cards, the next day's slate runs and schedules itself in OpenTweet with
figures from the new close. The copy is shared for review the evening before;
anything vetoed is taken out before the night run.

    NODE_USE_ENV_PROXY=1 npx tsx scripts/social/slates/2026-10-02.ts --dry    # copy, to output/slates/<date>/preview.md
    NODE_USE_ENV_PROXY=1 npx tsx scripts/social/slates/2026-10-02.ts --build  # images only
    NODE_USE_ENV_PROXY=1 npx tsx scripts/social/slates/2026-10-02.ts          # schedule

Before a slate runs, any reply link with a date or an odd amount must be in
`scripts/og/card-links.json` (and deployed), or its preview falls back to the
1 BTC card.

Discord delivery: `--discord` sends each post to `DISCORD_WEBHOOK_URL` as a
message to copy from (UK time, text, first reply) with its image or video
attached; `--note="…"` adds a grey line. With `--dry` it sends without
scheduling. The morning Routine sends every day's slate this way: alongside
OpenTweet until 5 Oct 2026, and instead of it from 6 Oct (trial ends).

    NODE_USE_ENV_PROXY=1 npx tsx scripts/social/slates/2026-10-04.ts --dry --discord --note="Post this yourself at the time shown."
