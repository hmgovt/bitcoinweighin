# Handoff 08 — Dynamic OG Images + Share Button + Historical Gold Video

*Three launch-critical assets. All are independent; any can be built first. None modify the existing commodity renderers or URL state logic.*

---

## Part A — Dynamic OG Images via Cloudflare Pages Functions

### Goal

When someone shares a Bitcoin Weigh-In URL on X, iMessage, Slack, Discord, or Reddit, the link preview card should show a dynamic image reflecting the current slider state — not a static fallback. This is the single highest-leverage launch asset: every share without a good preview card is a wasted impression.

Example: sharing `https://bitcoinweighin.com/?btc=1` should produce a card showing something like:

```
┌─────────────────────────────────────┐
│  ₿ Bitcoin Weigh-In                 │
│                                     │
│  1 BTC  =  23.5 troy oz of gold    │
│            ≈ 731 g  · 37.9 cm³     │
│            cube edge: 3.4 cm        │
│                                     │
│  bitcoinweighin.com                 │
└─────────────────────────────────────┘
```

### Architecture

The site uses `@sveltejs/adapter-static` — pure static files, no Workers runtime. **Do not change the adapter.** Instead, use **Cloudflare Pages Functions**, which are Workers that live alongside static assets. Any file in `functions/` becomes a serverless endpoint automatically.

The OG image endpoint lives at `functions/og-image.ts` (or `functions/og-image/[[path]].ts` if we want path-based routing later). It accepts query params matching the existing URL state: `?btc=1&date=2026-05-19&unit=imperial`.

### Tech stack for the endpoint

Use **`workers-og`** (https://github.com/kvnang/workers-og). It wraps Satori + resvg-wasm and is purpose-built for Cloudflare Workers. The API mirrors `@vercel/og`:

```typescript
import { ImageResponse } from 'workers-og';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const btc = parseFloat(url.searchParams.get('btc') || '1');
  // ... compute gold/silver/etc mass from btc amount
  // ... build HTML string with flexbox layout
  return new ImageResponse(html, { width: 1200, height: 630 });
};
```

### READ FIRST — before writing code, read and summarise back:

1. `src/lib/commodities.ts` — the commodity schema and density values
2. `public/prices.json` — structure and how to look up today's gold price
3. `src/lib/stores/url.ts` — how URL params are parsed (to match exactly)
4. The existing `<head>` section in `src/app.html` or the SvelteKit layout — what meta tags exist today
5. `package.json` — current deps, to check for conflicts

Tell me: (a) what meta tags are currently in the HTML head, (b) the exact schema of a prices.json entry, (c) whether there's an existing utility that computes mass-from-btc for a given commodity, (d) whether `functions/` directory exists yet.

### Implementation steps

**Step 1 — Install `workers-og`:**
```bash
npm install workers-og
```

**Step 2 — Create the Pages Function:**

File: `functions/og-image.ts`

The function should:

1. Parse query params: `btc` (float, default 1), `date` (ISO string, default today), `commodity` (string, default "gold")
2. Load today's prices. **Important constraint:** Pages Functions can't import from the SvelteKit src tree at runtime. The function needs its own lightweight price lookup. Two options:
   - **Option A (recommended):** Fetch `prices.json` from the same origin (`https://bitcoinweighin.com/prices.json`) using `fetch()` — Cloudflare will serve it from cache since it's a static asset on the same zone. Cache the response in the Workers Cache API to avoid re-fetching on every OG request.
   - **Option B:** Bundle a small price-lookup module in the `functions/` directory that reads from the KV binding or directly from the static asset.
3. Compute mass: `btcAmount × btcPriceUsd / commodityPricePerUnit × unitMassGrams`. Reuse the density and unit-mass constants — copy them into a small `functions/lib/commodities.ts` if needed (don't fight the import boundary).
4. Format the output: mass in troy oz (gold) or appropriate unit, volume in cm³, cube edge in cm. Imperial primary.
5. Render HTML with `ImageResponse`. Layout:
   - 1200×630 px (the universal OG size — works on Facebook, LinkedIn, Slack, Discord, iMessage; X crops slightly but acceptably)
   - Dark background matching the site's dark theme
   - Site logo or wordmark top-left (use the brand colours: orange/chrome)
   - BTC amount prominently displayed: "1 BTC"
   - Primary readout: "= 23.5 troy oz of gold"
   - Secondary: mass in grams, volume, cube edge
   - Footer: `bitcoinweighin.com`
   - **Satori constraint: flexbox only, no CSS grid.** Every container needs `display: flex`.

**Step 3 — Font loading:**

Satori requires font files as ArrayBuffers. Fetch a clean sans-serif (Inter or the site's actual font) from a CDN and cache it:

```typescript
async function loadFont(ctx: ExecutionContext): Promise<ArrayBuffer> {
  const cache = await caches.open('og-fonts');
  const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter-Bold.woff';
  const cached = await cache.match(fontUrl);
  if (cached) return cached.arrayBuffer();
  const res = await fetch(fontUrl);
  ctx.waitUntil(cache.put(fontUrl, res.clone()));
  return res.arrayBuffer();
}
```

**Step 4 — Wire meta tags in SvelteKit layout:**

In the SvelteKit layout (likely `src/routes/+layout.svelte` or `src/app.html`), add reactive OG meta tags that reflect the current URL state:

```html
<meta property="og:image" content="https://bitcoinweighin.com/og-image?btc={btc}&date={date}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:title" content="Bitcoin Weigh-In — {btc} BTC = {massReadout} of gold" />
<meta property="og:description" content="What does {btc} bitcoin weigh? Explore BTC purchasing power as physical commodities." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://bitcoinweighin.com/og-image?btc={btc}&date={date}" />
```

**Critical:** these meta tags must be server-rendered (present in the static HTML), not client-side injected. Since SvelteKit prerendering only produces one HTML file for a SPA, the meta tags in `app.html` will use the default values (btc=1). Social crawlers that execute JavaScript will see the correct dynamic values via `<svelte:head>`, but many crawlers (Facebook, LinkedIn, Slack) do NOT execute JS. Two options:

- **For the static site (simplest):** Accept that the default OG image is `?btc=1` for all shares from the HTML source. Users sharing specific slider positions get the dynamic image only if the crawler executes the JS `<svelte:head>` block. X and Discord do execute JS; Facebook and LinkedIn often don't.
- **For full dynamic support (stretch goal):** Add a second Pages Function as middleware that intercepts requests from known bot user-agents and injects the correct meta tags. This is a common pattern but adds complexity. Defer unless testing shows Facebook shares are broken.

**Step 5 — Caching:**

OG images are expensive to generate (~100-500ms with WASM). Add caching:

```typescript
const cacheKey = new URL(request.url);
cacheKey.pathname = '/og-image-cache' + cacheKey.search;
const cache = caches.default;
const cached = await cache.match(cacheKey);
if (cached) return cached;

const response = new ImageResponse(html, { width: 1200, height: 630 });
// Cache for 1 hour (prices update daily at 02:00 UTC)
const cloned = new Response(response.body, response);
cloned.headers.set('Cache-Control', 'public, max-age=3600');
ctx.waitUntil(cache.put(cacheKey, cloned));
return response;
```

**Step 6 — Known pitfalls (from community experience):**

- Satori's internal image fetch silently fails on Workers. If you embed images (e.g. the site logo), fetch them manually and convert to base64 data URLs before passing to the HTML template.
- Satori only supports PNG source images, not WebP. The brand logo is `header-logo.webp` — you'll need a PNG variant at `static/brand/header-logo.png` for the OG renderer.
- The resvg WASM module must be statically imported, not dynamically compiled. `workers-og` handles this, but if you hit WASM errors, check that wrangler is pre-compiling correctly.
- Cloudflare Workers free plan has a 10ms CPU time limit. OG generation can exceed this. Pages Functions on the free plan have a more generous 10ms-50ms budget but Satori+resvg can still be tight. If you hit CPU limits, the caching in Step 5 is essential — most OG requests will be cache hits from social crawlers hitting the same URL repeatedly.

### Testing

1. `wrangler pages dev build/` to test locally (serves static build + Pages Functions)
2. Hit `http://localhost:8788/og-image?btc=1` — should return a PNG
3. Hit `http://localhost:8788/og-image?btc=0.001` — numbers should change
4. Hit `http://localhost:8788/og-image?btc=100` — numbers should change
5. After deploy, validate with:
   - https://cards-dev.twitter.com/validator (X card preview)
   - https://developers.facebook.com/tools/debug/ (Facebook OG debugger)
   - Paste URL into a Slack DM to yourself

### Scope guard

Do NOT modify:
- The commodity renderers or PhysicalRep component
- The URL state store logic
- prices.json structure or the data pipeline
- The site's visual design or dark theme CSS

This is a standalone serverless function + meta tag wiring. Keep it contained.

---

## Part B — Historical Gold Video Generator

### Goal

Produce a short video showing how **1000 BTC's** purchasing power in gold changes across the full price history (2013-01-01 to today). This is launch content for X, HN, and the methodology page. The video tells the entire concept of the site in one visual sweep.

**Why 1000 BTC, not 1:** At 1 BTC, the 2013 gold cube is sub-millimetre (1 BTC ≈ $13, gold ≈ $1700/oz → ~0.24 g → invisible). At 1000 BTC:

| Date | BTC price | Gold price/oz | 1000 BTC buys | Cube edge |
|------|-----------|---------------|---------------|-----------|
| 2013-01-01 | ~$13 | ~$1,700 | ~237 g | ~2.3 cm |
| 2017-12-17 | ~$19,000 | ~$1,260 | ~469 kg | ~29 cm |
| 2018-12-15 | ~$3,200 | ~$1,240 | ~80 kg | ~16 cm |
| 2021-11-10 | ~$69,000 | ~$1,860 | ~1,154 kg | ~39 cm |
| 2024-01-01 | ~$44,000 | ~$2,060 | ~664 kg | ~33 cm |
| Today | ~$103,000 | ~$3,300 | ~970 kg | ~37 cm |

Visual arc: marble → fist → dog-sized block. The Shiba stays constant at 40 cm; the cube grows and shrinks dramatically around it. That IS the site's concept in one animation.

### Approach: Playwright screenshot → ffmpeg stitch

No scrubber UI required. Drive a headless browser across the full price history by setting URL params, screenshot the gold panel each frame, stitch into video.

### READ FIRST — before writing code, read and summarise back:

- SPEC.md sections on URL state hydration, the gold panel renderer, and anchor events
- `src/lib/events.json` (or wherever anchor events live) — schema and count
- `scripts/` directory layout
- `public/prices.json` — confirm earliest date is 2013-01-01 and coverage is continuous
- The gold panel component — does it expose a rendered/ready signal, or does it snap instantly on URL change?

Tell me, in your own words: (a) the actual earliest and latest dates in prices.json, (b) the file path to the events JSON and its schema, (c) whether there's an existing "panel rendered with current date's data" signal we can await, or whether one needs adding, (d) whether the gold panel animates on date change or snaps.

### Implementation

**File:** `scripts/make-gold-video.ts`

**Dependencies:** `playwright`, `ffmpeg` (system binary — verify available in the dev environment or install via brew/apt)

**Config object per cut:**

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
  { name: 'x-landscape',  width: 1280, height: 720,  stepDays: 7,  fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },  // ~23s
  { name: 'hn-long',      width: 1280, height: 720,  stepDays: 3,  fps: 30, btcAmount: 1000, anchorHoldFrames: 60 },  // ~54s
  { name: 'shorts-vert',  width: 1080, height: 1920, stepDays: 5,  fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },  // ~30s, vertical for TikTok/Shorts/Reels
];
```

**Frame capture loop:**

```typescript
for (let d = startDate; d <= endDate; d = addDays(d, config.stepDays)) {
  const dateStr = formatISO(d);
  await page.goto(`http://localhost:5173/?btc=${config.btcAmount}&date=${dateStr}`, {
    waitUntil: 'networkidle'
  });

  // Wait for gold panel to render with current date's data.
  // If there's a data-rendered="true" attribute or similar, wait for it.
  // Otherwise, wait for the readout strip text to contain the date or a non-zero mass.
  await page.waitForSelector('[data-commodity="gold"]', { state: 'visible' });
  // Additional: waitForFunction checking readout text isn't stale

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

**Overlay pass — BEFORE ffmpeg stitch:**

Burn in a date readout and anchor event captions. Two approaches (pick one):

- **Playwright injection (recommended):** Before each screenshot, inject an absolutely-positioned HTML overlay div with the date string (e.g. "Jan 2013") and, for anchor events, a caption card (e.g. "Pizza Day — 10,000 BTC for two pizzas"). Style it to match the site's dark theme and brand typography. This is easier to iterate than ffmpeg text filters.

- **ffmpeg drawtext (alternative):** Use ffmpeg's drawtext filter with a subtitle file. More complex to set up but keeps the Playwright loop simple.

**Anchor events to mark** (verify against events.json — these are examples):

1. Genesis block (2009 — outside dataset, skip)
2. Pizza Day (2010-05-22 — outside dataset if prices.json starts 2013, skip)
3. First $100 (early 2013)
4. Mt. Gox collapse (Feb 2014)
5. First halving in dataset range (2016-07-09)
6. $20k peak (Dec 2017)
7. COVID crash (Mar 2020)
8. Third halving (2020-05-11)
9. $69k ATH (Nov 2021)
10. FTX collapse (Nov 2022)
11. Spot ETF approval (Jan 2024)
12. Fourth halving (2024-04-20)
13. $100k breach (Dec 2024)

Cross-reference with events.json. Only show events that fall within the dataset range.

**ffmpeg stitch:**

```bash
ffmpeg -framerate 30 \
  -i "frames/${name}/%05d.png" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -crf 18 \
  -movflags +faststart \
  "output/${name}.mp4"
```

`-movflags +faststart` is important — it moves the moov atom to the front so the video starts playing immediately on web and social platforms.

Also produce a WebM for site embedding:
```bash
ffmpeg -framerate 30 \
  -i "frames/${name}/%05d.png" \
  -c:v libvpx-vp9 \
  -crf 30 -b:v 0 \
  "output/${name}.webm"
```

**Output manifest:**

Write `output/manifest.json` per cut:

```json
{
  "name": "x-landscape",
  "btcAmount": 1000,
  "dateRange": ["2013-01-01", "2026-05-19"],
  "totalFrames": 1423,
  "anchorEventsMarked": 11,
  "duration": "47.4s",
  "resolution": "1280x720",
  "files": ["x-landscape.mp4", "x-landscape.webm"]
}
```

### Platform compatibility check

| Platform | Format | Max duration | Max size | Aspect | ✓ |
|----------|--------|-------------|----------|--------|---|
| X (Twitter) | MP4 H.264 | 2:20 | 512 MB | 16:9 | x-landscape ✓ |
| HN / Reddit | MP4 native | — | — | any | hn-long ✓ |
| YouTube Shorts | MP4 H.264 | 60s | — | 9:16 | shorts-vert ✓ |
| TikTok | MP4 H.264 | 60s | — | 9:16 | shorts-vert ✓ |
| Instagram Reels | MP4 H.264 | 90s | — | 9:16 | shorts-vert ✓ |
| Site `<video>` | MP4 or WebM | any | any | any | both ✓ |

For site embedding: `<video autoplay muted loop playsinline src="/video/x-landscape.mp4">` — the `muted` and `playsinline` attributes are required for browser autoplay policy.

### Preconditions

1. **The viewport sizing fix** (`max(shibaHeightM, cubeEdgeM) × ~1.10 margin`) must be on `main` and working. If the gold panel still has broken scaling, the video captures the bug. Verify before running.
2. **prices.json must cover 2013-01-01 to present.** Run a quick check: `node -e "const p = require('./public/prices.json'); console.log(Object.keys(p).sort()[0], Object.keys(p).sort().pop())"` — first key should be `2013-01-01` or close.
3. **The gold panel must render correctly at `?btc=1000`.** Manually verify in the browser before automated capture.
4. **Playwright and ffmpeg must be available.** Install: `npm install -D playwright @playwright/test && npx playwright install chromium`. ffmpeg: `brew install ffmpeg` (Mac) or `sudo apt install ffmpeg` (Linux).

### Runtime estimate

~1,620 frames (3-day step) × ~2-3 seconds per frame (goto + render + screenshot) = 50-80 minutes for the long cut. The 7-day step cut is ~700 frames = 25-35 minutes. The vertical cut is similar. Total: ~2-3 hours for all three cuts. Run overnight on the first attempt.

### Scope guard

Do NOT modify:
- The gold panel renderer or any commodity component
- URL state logic
- prices.json or the data pipeline
- Site layout or styles

This is a standalone script in `scripts/` that reads the existing site via a headless browser. It produces video files in `output/`. The only site-facing change would be placing the final video in `static/video/` for embedding — but that's a separate, trivial step.

---

## Part C — Share Component

### Goal

A single, elegant share affordance that lets visitors share their current slider position to any major platform. The URL-as-state architecture means the shared link reproduces the exact view — this is the viral loop. The share button is what makes it happen; the OG image (Part A) is what makes it look good when it lands.

### Design principles

- **Not a row of brand-coloured buttons.** That's 2014. The site's brand voice is precise and slightly dry — the share UI should match. Think: a single share icon (or the word "Share") that opens a compact popover or bottom sheet with platform options.
- **Mobile-first.** On mobile, prefer the **Web Share API** (`navigator.share()`) as the primary action — it opens the native share sheet, which is faster and covers every app the user has installed. The platform-specific buttons are the desktop fallback.
- **Sticky but unobtrusive.** The share button should be accessible from any scroll position without dominating the viewport. Options: fixed position near the slider, or within the header bar.
- **Pre-composed text per platform.** The share text should be interesting, not generic. Include the current readout dynamically.

### READ FIRST — before writing code:

1. `src/lib/stores/url.ts` — how current BTC amount and date are tracked
2. The gold panel readout — how mass/volume text is computed (to pull into share text)
3. The existing header/nav component — where the share button will live visually
4. `src/app.html` — existing meta tags, to ensure share URLs have correct OG markup

Tell me: (a) how the current BTC amount and primary commodity readout (e.g. "23.5 troy oz of gold") are exposed as reactive values, (b) what the header component looks like and whether there's space for a share button, (c) whether `navigator.share` is already used anywhere.

### Implementation

**Component:** `src/lib/components/ShareButton.svelte`

**Step 1 — Web Share API (mobile primary path):**

```typescript
async function handleShare() {
  const url = window.location.href; // already contains full state
  const text = buildShareText();

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Bitcoin Weigh-In', text, url });
      return; // native sheet handled it
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled, not an error
    }
  }
  // Fallback: open the popover with platform buttons
  showPopover = true;
}
```

When `navigator.share` is available (all modern mobile browsers, plus Safari and Edge on desktop), tapping Share opens the OS-native share sheet. No popover needed. This covers every app — WhatsApp, Telegram, SMS, email, Notes, Instagram DMs — without us building buttons for each.

**Step 2 — Desktop fallback popover:**

When `navigator.share` is unavailable (Firefox and Chrome on desktop), show a compact popover with platform-specific share links. These platforms have URL-based share intents that work without any SDK or script:

```typescript
interface ShareTarget {
  name: string;
  icon: string; // SVG path or component
  buildUrl: (shareUrl: string, shareText: string) => string;
}

const targets: ShareTarget[] = [
  {
    name: 'X',
    icon: '...', // X logo SVG
    buildUrl: (url, text) =>
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  },
  {
    name: 'Facebook',
    icon: '...',
    buildUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  },
  {
    name: 'Reddit',
    icon: '...',
    buildUrl: (url, text) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`
  },
  {
    name: 'LinkedIn',
    icon: '...',
    buildUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  },
  {
    name: 'Pinterest',
    icon: '...',
    // Pinterest needs an image URL — use the OG image endpoint from Part A
    buildUrl: (url, text) =>
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(`https://bitcoinweighin.com/og-image?btc=${getCurrentBtc()}`)}&description=${encodeURIComponent(text)}`
  },
  {
    name: 'WhatsApp',
    icon: '...',
    buildUrl: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
  },
  {
    name: 'Copy link',
    icon: '...', // clipboard icon
    buildUrl: () => '' // handled separately via navigator.clipboard
  }
];
```

Each target opens in a new window/tab via `window.open(url, '_blank', 'width=600,height=400')`. The "Copy link" option uses `navigator.clipboard.writeText(url)` and shows a brief "Copied!" confirmation.

**Instagram note:** Instagram has no URL-based share intent for feed posts. The Web Share API on mobile covers Instagram DMs and Stories. On desktop, Instagram sharing isn't possible — omit it from the desktop popover. Don't include a dead button.

**Step 3 — Dynamic share text:**

The share text should reflect the current slider position and read as a discovery, not a promotion:

```typescript
function buildShareText(): string {
  const btc = getCurrentBtcAmount();
  const goldReadout = getCurrentGoldReadout(); // e.g. "23.5 troy oz"

  // Vary the framing to avoid every share looking identical
  const templates = [
    `${btc} BTC buys ${goldReadout} of gold. What does yours buy?`,
    `${goldReadout} of gold. That's what ${btc} bitcoin gets you today.`,
    `Ever wondered what ${btc} BTC weighs in gold? ${goldReadout}.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}
```

The randomisation is per-share-action, not per-page-load. Keep it simple — three templates is enough. The URL carries the full state; the text is the hook.

**Step 4 — Visual design:**

The share button should be a single icon or small text link, not a cluster of logos. Specifics:

- **Placement:** In the sticky header bar, right side, near the Beehiiv newsletter CTA. If there's no header bar yet, place it as a fixed-position element near the BTC slider.
- **Resting state:** A minimal share icon (the standard "arrow out of box" or a simple node-and-lines icon) in the site's secondary text colour. No label on mobile (icon only); optional "Share" label on desktop beside the icon.
- **Hover/tap:** Subtle brightness or scale bump. On mobile, directly triggers `navigator.share()`. On desktop, opens the popover.
- **Popover style:** Compact, dark-themed to match the site. A small grid or vertical list of icon + label pairs. Appears anchored to the share button (not a centred modal). Dismisses on click-outside or Escape.
- **Icons:** Use simple monochrome SVG icons for each platform, tinted to the site's text colour. Not the platforms' brand colours — that breaks the visual cohesion. The icons identify the platform; the colour belongs to the site.
- **Animation:** Popover fades in over ~150ms. No bouncing, no sliding, no confetti.
- **"Copied!" feedback:** When "Copy link" is tapped, the clipboard icon briefly morphs to a checkmark with a 1.5s timeout, then reverts. Text "Copied!" appears briefly beside it.

**Step 5 — Accessibility:**

- The share button has `aria-label="Share this page"`
- The popover has `role="dialog"` and `aria-label="Share options"`
- Each platform button has `aria-label="Share on X"` (etc.)
- Focus traps inside the popover when open; Escape closes it
- "Copy link" announces "Link copied" to screen readers via a live region

### Testing

1. **Mobile (real device or DevTools emulation):** Tap share → native share sheet opens with pre-composed text and URL. Verify URL includes current `?btc=` and `?date=` params.
2. **Desktop Chrome/Firefox:** Click share → popover appears with platform list. Click each platform → correct share URL opens in new window. Verify `encodeURIComponent` handles special characters.
3. **X share:** Click X → tweet compose opens with text + URL. Post it. Verify the OG card preview shows the dynamic image from Part A.
4. **Copy link:** Click → clipboard contains full URL. "Copied!" confirmation appears and auto-dismisses.
5. **Keyboard:** Tab to share button → Enter opens popover → Tab through options → Enter selects → Escape closes.
6. **Different slider positions:** Share at 0.001 BTC, 1 BTC, 1000 BTC — text and URL update correctly each time.

### Scope guard

Do NOT modify:
- The URL state logic (the share button reads it, doesn't write it)
- The commodity renderers
- The OG image function (Part A) — this component just links to it for Pinterest's `media` param
- The newsletter signup component

This is a self-contained Svelte component placed into the existing layout.

---

## Delivery order suggestion

1. **OG images first** — unblocks good-looking shares immediately
2. **Share button second** — depends on OG images for the preview cards to look right, and for Pinterest's `media` param
3. **Video third** — launch content, can be produced the night before posting

All three are independent sessions. Commit each separately with conventional commit messages:
- `feat: add dynamic OG image generation via Pages Function`
- `feat: add share button with Web Share API and desktop fallback`
- `feat: add historical gold video generator script`
