# Handoff 08 — Historical Gold Video Generator

*Standalone session. Does not modify any site components, URL state logic, prices.json, or styling. Produces video files in `output/`.*

---

## Goal

Produce short videos showing how **1000 BTC's** purchasing power in gold changes across the full price history (2013-01-01 to today). This is launch content for X, HN, and the methodology page. The video tells the entire concept of the site in one visual sweep.

**Why 1000 BTC, not 1:** At 1 BTC, the 2013 gold cube is sub-millimetre (invisible). At 1000 BTC the visual arc runs from a 2.3 cm marble (Jan 2013) to a ~37 cm block (today), growing and shrinking dramatically around the 40 cm Shiba. That IS the site's concept in one animation.

**The math (for sanity-checking frames, not hardcoding):**

```
massGrams = (btcAmount × btcPriceUSD) / (goldPricePerOzUSD / 31.1035)
cubeEdgeCm = ∛(massGrams / 19.30)
```

---

## Step 0 — Install dependencies

Playwright and ffmpeg are not yet installed. Do this first.

```bash
# Playwright (dev dependency + Chromium binary)
npm install -D playwright @playwright/test
npx playwright install chromium

# ffmpeg — check if already available, install if not
which ffmpeg || brew install ffmpeg   # macOS
# or: which ffmpeg || sudo apt install ffmpeg   # Linux
```

Confirm both are working before proceeding:
```bash
npx playwright --version
ffmpeg -version
```

---

## Step 1 — Read first, summarise, then wait

Open and read:

1. `src/lib/events.json` — anchor events schema and count
2. `public/prices.json` — confirm earliest date is 2013-01-01, coverage is continuous, latest date is recent
3. `scripts/` directory layout — understand existing script patterns
4. The gold panel component — does it expose a rendered/ready signal, or does it snap instantly on URL change?
5. The URL state store — confirm `?btc=1000&date=2013-05-01` hydrates correctly

Tell me, in your own words:
- (a) the actual earliest and latest dates in prices.json
- (b) the file path to events.json and its schema
- (c) whether there's an existing "panel rendered with current date's data" signal we can await, or whether one needs adding
- (d) whether the gold panel animates on date change or snaps

**Stop. Wait for confirmation before writing code.**

---

## Step 2 — Implementation

### File: `scripts/make-gold-video.ts`

### Config object per cut

```typescript
interface VideoConfig {
  name: string;
  width: number;
  height: number;
  stepDays: number;       // days between frames
  fps: number;
  btcAmount: number;      // 1000
  anchorHoldFrames: number; // extra frames to hold on anchor events
}

const cuts: VideoConfig[] = [
  { name: 'x-landscape',  width: 1280, height: 720,  stepDays: 7,  fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },  // ~23s for X
  { name: 'hn-long',      width: 1280, height: 720,  stepDays: 3,  fps: 30, btcAmount: 1000, anchorHoldFrames: 60 },  // ~54s for HN / methodology page
  { name: 'shorts-vert',  width: 1080, height: 1920, stepDays: 5,  fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },  // ~30s vertical for TikTok/Shorts/Reels
];
```

### Frame capture loop

```typescript
for (let d = startDate; d <= endDate; d = addDays(d, config.stepDays)) {
  const dateStr = formatISO(d);   // YYYY-MM-DD
  await page.goto(`http://localhost:5173/?btc=${config.btcAmount}&date=${dateStr}`, {
    waitUntil: 'networkidle'
  });

  // Wait for gold panel to render with current date's data.
  // If there's a data-rendered="true" attribute or similar, wait for it.
  // Otherwise, wait for the readout strip to contain a non-zero mass value.
  await page.waitForSelector('[data-commodity="gold"]', { state: 'visible' });
  // Additional: waitForFunction checking readout text isn't stale from previous frame

  await page.screenshot({
    path: `frames/${config.name}/${String(frameIndex).padStart(5, '0')}.png`,
    clip: goldSectionBoundingBox  // capture only the gold panel, not the full page
  });

  // If this date matches an anchor event, duplicate the frame anchorHoldFrames times
  // to create a visual "pause" at that moment
  if (isAnchorEvent(d, events)) {
    for (let h = 0; h < config.anchorHoldFrames; h++) {
      copyFrame(frameIndex, ++frameIndex, config.name);
    }
  }

  frameIndex++;
}
```

### Overlay — Playwright injection (preferred approach)

Before each screenshot, inject an absolutely-positioned HTML overlay div with:
- **Date readout** (always visible): e.g. "Jan 2013", styled in the site's dark theme typography
- **Anchor event caption** (on event dates only): e.g. "Pizza Day — 10,000 BTC for two pizzas", held for `anchorHoldFrames`

Style the overlay to match the site's existing dark theme and brand typography. This is easier to iterate than ffmpeg drawtext filters.

### Anchor events to mark

Cross-reference with `src/lib/events.json`. Only show events that fall within the prices.json date range. Expected events (verify against actual file):

1. Pizza Day (2010-05-22 — may be outside dataset range, skip if so)
2. First halving (2012-11-28 — may be outside range)
3. Mt Gox peak (2013-11-29)
4. Mt Gox goes dark (2014-02-07)
5. Second halving (2016-07-09)
6. First $20k (2017-12-17)
7. COVID crash (2020-03-12)
8. Third halving (2020-05-11)
9. El Salvador adopts BTC (2021-09-07)
10. FTX collapse (2022-11-11)
11. US spot ETFs launch (2024-01-11)
12. Fourth halving (2024-04-20)

### ffmpeg stitch

```bash
# MP4 for X / web
ffmpeg -framerate 30 \
  -i "frames/${name}/%05d.png" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -crf 18 \
  -movflags +faststart \
  "output/${name}.mp4"

# WebM for site <video> embedding
ffmpeg -framerate 30 \
  -i "frames/${name}/%05d.png" \
  -c:v libvpx-vp9 \
  -crf 30 -b:v 0 \
  "output/${name}.webm"
```

`-movflags +faststart` moves the moov atom to the front so the video starts playing immediately on social platforms.

### Output manifest

Write `output/manifest.json` per cut:

```json
{
  "name": "x-landscape",
  "btcAmount": 1000,
  "dateRange": ["2013-01-01", "2026-05-23"],
  "totalFrames": 1423,
  "anchorEventsMarked": 11,
  "duration": "47.4s",
  "resolution": "1280x720",
  "files": ["x-landscape.mp4", "x-landscape.webm"]
}
```

---

## Platform compatibility

| Platform | Format | Max duration | Aspect | Cut |
|----------|--------|-------------|--------|-----|
| X (Twitter) | MP4 H.264 | 2:20 | 16:9 | x-landscape ✓ |
| HN / Reddit | MP4 | — | any | hn-long ✓ |
| YouTube Shorts | MP4 H.264 | 60s | 9:16 | shorts-vert ✓ |
| TikTok | MP4 H.264 | 60s | 9:16 | shorts-vert ✓ |
| Instagram Reels | MP4 H.264 | 90s | 9:16 | shorts-vert ✓ |
| Site `<video>` | MP4 or WebM | any | any | both ✓ |

For site embedding: `<video autoplay muted loop playsinline src="/video/x-landscape.mp4">` — `muted` and `playsinline` are required for browser autoplay policy.

---

## Runtime estimate

~1,620 frames (3-day step) × ~2-3 seconds per frame = 50-80 minutes for the long cut. The 7-day step cut is ~700 frames = 25-35 minutes. Total for all three cuts: ~2-3 hours. Run overnight on the first attempt.

---

## Running the script

The site's dev server must be running in a separate terminal before you start:

```bash
# Terminal 1: start the dev server
npm run dev

# Terminal 2: run the video generator
npx tsx scripts/make-gold-video.ts
```

If `npx tsx` is not available, add `tsx` as a dev dependency: `npm install -D tsx`.

---

## Scope guard

Do NOT modify:
- The gold panel renderer or any commodity component
- URL state logic
- prices.json or the data pipeline
- Site layout, styles, or dark theme CSS

This is a standalone script in `scripts/` that reads the existing site via a headless browser. It produces video files in `output/`. The only site-facing change after this session would be placing the final video in `static/video/` for embedding — that's a separate trivial step.

---

## Done when

- All three cuts (x-landscape, hn-long, shorts-vert) produce playable MP4 + WebM files in `output/`
- Date overlay is legible and styled consistently with the site's dark theme
- Anchor event captions display and hold for the configured number of frames
- Manifest JSON is written for each cut
- No console errors during capture
- Conventional commit: `feat: add historical gold video generator script`
