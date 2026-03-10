# Certificate Generation Plan

Printable achievement certificates for racers, accessible from the local network.

## Goal

After awards, every kid gets a certificate — either printed by a volunteer or pulled up on a parent's phone. The certificate should always make the kid feel good. Top finishers get placement certificates; mid-pack racers get their den ranking highlighted; everyone gets their personal stats celebrated. No new backend endpoints needed — den rankings are computed client-side from existing standings data.

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/certificate/:racerId` | Public | Single racer certificate (shareable link) |
| `/certificates` | Admin | Batch view — all racers for the current event, one per page |

Individual certificates are public so parents can view them on their own phones. The batch page is admin-only to avoid spoiling results before the awards ceremony.

## Data per Certificate

All available from existing endpoints (`GET /api/racers/:id`, `GET /api/events/:id/standings`, `GET /api/racers/:id/photo`):

- **Racer**: name, den, car number, car photo
- **Standing**: overall placement, wins, losses, best time
- **Den ranking**: computed client-side by filtering standings to same-den racers and sorting
- **Event**: name, date

## Den Rankings — "Every Kid Wins Something"

The core idea: if a kid isn't in the overall top 10, highlight where they placed **within their den**. A kid who's 27th overall but 1st in Wolves still has a huge achievement worth celebrating.

### Certificate tiering logic

```
if (overall top 3)        → "1st / 2nd / 3rd Place" with medal styling
else if (overall top 10)  → "Top 10 Finish" with placement number
else if (den top 3)       → "Fastest Wolf!" / "2nd in Bears!" with den image
else if (not bottom 2     → "Certificate of Achievement" with personal stats
         in their den)
else                      → "Certificate of Achievement" with personal stats
                            (same as above — no ranking shown, just stats)
```

The bottom-2-in-den rule is simple: never show a ranking that makes a kid feel bad. A kid who's 5th out of 6 Wolves doesn't need to see "5th in Wolves" — they see their wins and best time instead.

### What gets emphasized at each tier

| Tier | Headline | Emphasis |
|------|----------|----------|
| Overall top 3 | "1st Place" | Medal, gold/silver/bronze styling |
| Overall top 10 | "Top 10 — 7th Place" | Placement badge, overall rank |
| Den top 3 | "Fastest Wolf!" | Den image, den-colored border |
| Mid-pack | "Certificate of Achievement" | Personal stats: wins, best time |
| Bottom of den | "Certificate of Achievement" | Same — no ranking shown |

### Den champion callout

"Fastest [Den]!" (1st in den) is the strongest callout. Use the den image prominently, the den color for the certificate border accent, and large bold text. This is the highlight moment for mid-pack racers.

"2nd in [Den]" and "3rd in [Den]" are shown but with less prominence than den champion.

## Certificate Design

```
┌───────────────────────────────────────────────────────┐
│  ╔═════════════════════════════════════════════════╗   │
│  ║          CERTIFICATE OF ACHIEVEMENT            ║   │
│  ║                                                ║   │
│  ║      [Fleur-de-lis / LilyChevron motif]        ║   │
│  ║                                                ║   │
│  ║            This certifies that                 ║   │
│  ║                                                ║   │
│  ║            ══ TOMMY SCOUT ══                   ║   │
│  ║            Wolves Den  ·  Car #17              ║   │
│  ║                                                ║   │
│  ║        ★ Fastest Wolf! ★                       ║   │
│  ║                                                ║   │
│  ║   4 Wins  ·  Best Time: 3.214s                 ║   │
│  ║                                                ║   │
│  ║   ┌────────┐  [den image]                      ║   │
│  ║   │ car    │     Spring Derby 2026             ║   │
│  ║   │ photo  │     March 15, 2026                ║   │
│  ║   └────────┘                                   ║   │
│  ║                                                ║   │
│  ║   [den-colored border accent]                  ║   │
│  ╚═════════════════════════════════════════════════╝   │
└───────────────────────────────────────────────────────┘
```

### Tier styling

- **Overall 1st**: gold border accent (`amber-400`), large medal emoji
- **Overall 2nd**: silver/slate accent
- **Overall 3rd**: bronze/orange accent
- **Overall top 10**: navy `#003F87` border, placement badge
- **Den champion**: den-colored border (from `DEN_BORDER` map), den image prominent, "Fastest [Den]!" headline
- **Den 2nd/3rd**: lighter den-colored border, "2nd in [Den]"
- **Achievement**: navy border, personal stats emphasized, no ranking

### Brand elements

- Navy `#003F87` + crimson `#CE1126` palette
- Anton / Rajdhani fonts (already loaded in the app)
- LilyChevron motifs as decorative elements
- Den images (`src/frontend/assets/dens/`) next to the den name

## Den Rankings in the App (Beyond Certificates)

The den ranking concept should also surface in the main app:

### Standings view
- Add a "Den" filter toggle — click a den name to filter standings to just that den
- When filtered, re-rank 1st/2nd/3rd within the den (gold/silver/bronze styling)
- The existing den column and sort-by-den already exist; filtering is the missing piece

### Racer profile
- Show "N of M in [Den]" in the stats area (e.g., "1st of 7 Wolves")
- Only show if the ranking is positive (top half of den, not bottom 2)

### Display / projector
- After showing overall standings, cycle through "Den Champions" — one slide per den showing the top 3 racers in that den with den image and colors

### Computation

Den rankings are computed client-side from the existing standings array:

```ts
function denRankings(standings: Standing[], den: string): Standing[] {
  return standings
    .filter(s => s.den === den)
    .sort((a, b) => {
      // Same sort as overall: wins DESC, losses ASC, avg time ASC
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return (a.avg_time ?? Infinity) - (b.avg_time ?? Infinity);
    });
}
```

No new API endpoint needed — the frontend already has all standings in context.

## Implementation

### 1. New entry point: `src/frontend/certificate.html` + `certificate.tsx`

A self-contained mini-app like `display.html` — isolated from the main SPA bundle. Keeps the certificate rendering out of the main bundle size.

### 2. `CertificateView.tsx`

- Reads `racerId` from URL path (single mode) or fetches all racers + standings (batch mode)
- Computes den rankings from standings array
- Determines certificate tier for each racer
- Renders certificate template with print-optimized CSS
- Includes a "Print" button (hidden in print) and a "Back" link

### 3. Shared den ranking utility: `src/frontend/lib/den-utils.ts`

Extend the existing `den-utils.ts` (which already exports `DEN_IMAGES`) with:
- `denRankings(standings, den)` — sorted standings within a den
- `denPlacement(standings, racerId)` — returns `{ rank, total, den }` for a racer
- `shouldShowDenRank(rank, total)` — returns false if bottom 2

This utility is shared between certificates, standings, and racer profile.

### 4. Print CSS

```css
@media print {
  body { margin: 0; }
  .certificate {
    page-break-after: always;
    width: 100vw;
    height: 100vh;
  }
  .no-print { display: none; }
}
@page {
  size: landscape;
  margin: 0.5in;
}
```

PDF export works for free via the browser's "Save as PDF" print option.

### 5. Server route

```ts
// src/index.ts
"/certificate": certificate,    // HTML entry point
"/certificate/:id": certificate, // SPA handles routing
"/certificates": certificate,
```

## Sharing Flow

1. After awards, admin shows a QR code on the projector linking to `/certificates`
2. Parents scan, find their kid, screenshot or print
3. Or: standings page gets a small "Certificate" icon-link per racer row
4. Or: racer profile page gets a "Print Certificate" button

## Future Enhancements

- **Custom signatures** — admin types "Cubmaster [Name]" that appears on all certificates
- **Event logo upload** — pack logo in the certificate header
- **QR code on certificate** — link back to the racer's profile page for digital keepsake
- **"Most Improved"** — track across multiple events if the same racer name appears
- **Den awards ceremony mode** — display page cycles through dens, revealing den champion with animation
