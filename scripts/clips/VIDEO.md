# Video brief: TikTok, Reels, Shorts

How our videos are built to be watched to the end. Researched 7 Oct 2026 from
creator and marketing write-ups (sources at the end); the hard rules in
`scripts/social/WRITING.md` still apply: every number true and on screen as
the site computes it, no invented stories, no fake scarcity.

## The first second

- **Frame one is the payoff.** No intro, no logo, no fade from black, no quote
  card. Lead with the most striking picture and the headline already on
  screen. The feed decides within about 1.5 s whether to keep showing a
  video; showing the result first is the fix most often cited for early
  drop-off.
- **Text on screen in frame one**, high contrast, one idea, readable in under
  a second. Most people watch muted.
- **Sound from frame one** if there is sound: a hit on the first frame, not a
  fade-in, and nothing harsh.

## Keeping them

- **A new beat every 8–10 seconds.** Drop-off spikes around 8–15 s; a fresh
  subject, number or question resets it. Our unit is a new stack or a new
  amount.
- **Open loops.** Pose a question before answering it ("BlackRock vs
  Strategy: whose bitcoin buys more?").
- **Best payoff early, not saved for the end.** The opening claim must be
  the strongest; later beats build to it, they don't top it.
- **Text at 5–10 words a second**, one line at a time.

## Length and the ending

- **Completion rate matters more than length.** A 90 s video at 30%
  completion loses to a 30 s video at 80%. Aim for about 70%.
- **Over 60 s** qualifies for TikTok's Creator Rewards Program (the one
  documented length rule), so the long cuts run just past a minute.
- **Loop.** End on the opening frame with no "that's it" or fade, so a
  replay feels like the same video continuing.

## Safe zone (1080×1920; half that in our 540×960 capture)

TikTok's UI covers the top ~160 px (tabs), the bottom ~480 px (caption,
sound) and the right ~120 px (buttons). Keep text and the subject inside;
the map or stage can run underneath.

## In this repo

- `make-manhattan-clip.ts --cut=long` → `/clip/manhattan-long`, timeline
  `src/lib/clips/manhattanLongClip.ts`, score `score-manhattan-long.ts`.
- `make-metals-clip.ts`, `make-ride-clip.ts`: shorter cuts.

Sources: [TikTok 3-second rule (Teleprompter)](https://www.teleprompter.com/blog/tiktok-3-second-rule),
[Hook retention, 2026 (Hypenest)](https://hypenest.ai/blogs/tiktok-algorithm-2026-video-hooks-retention),
[Length and retention data (OpusClip)](https://www.opus.pro/blog/tiktok-length-format-retention-data),
[Retention benchmarks by length (Retensis)](https://retensis.com/blog/tiktok-retention-rate-benchmarks-2026),
[Length: documented vs folklore (SocialRails)](https://socialrails.com/blog/best-tiktok-video-length-maximum-engagement),
[70% completion (Betterview)](https://betterview.nl/en/blog/tiktok-completion-rate-70-procent-2026),
[Loops (The Social Cat)](https://thesocialcat.com/glossary/video-loop-short-form-content),
[Safe zones (House of Marketers)](https://www.houseofmarketers.com/guide-to-safe-zones-tiktok-facebook-instagram-stories),
[Ad creative best practices (MB Adv)](https://www.mbadv.agency/tiktok-ads/creative-best-practices).
