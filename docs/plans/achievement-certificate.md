# Certificate Generation Plan

Printable achievement certificates for racers, accessible from the local network.

## Goal

After awards, every kid gets a certificate — either printed by a volunteer or pulled up on a parent's phone. The certificate should always make the kid feel good. Top finishers get placement certificates; mid-pack racers get their den ranking highlighted; everyone gets their personal stats celebrated. No new backend endpoints needed — den rankings are computed client-side from existing standings data.

## Status: Implemented

The core certificate system is fully implemented and working. This document reflects the current state and remaining work.

## Routes

All three routes serve `certificate.html`, a standalone mini-app isolated from the main SPA bundle:

| Route | Access | Description | Status |
|-------|--------|-------------|--------|
| `/certificate/:racerId` | Public | Single racer certificate (shareable link) | Done |
| `/certificates` | Public* | Batch view — all racers, one per page, sorted by standings | Done |
| `/certificate` | Public* | Same entry point (redirects) | Done |

*The plan called for `/certificates` to be admin-only to avoid spoiling results before the awards ceremony. Currently all routes are public. Admin gating can be added when auth is implemented (see `auth.md`).

## Certificate Tiering

Implemented in `src/frontend/certificate.tsx` via `classifyRacer()`:

```
if (overall top 3)        → podium — "1st Place" / "2nd Place" / "3rd Place" with medal emoji
else if (overall top 10)  → top10 — "Top 10 — 7th Place" with navy ribbon
else if (den top 3)       → den_champion (1st) — "Fastest Wolf!" with den-colored ribbon
                            den_top3 (2nd/3rd) — "2nd in Wolves!" with den-colored ribbon
else                      → achievement — "Pinewood Derby Racer" with navy ribbon
```

The bottom-2-in-den rule (`shouldShowDenRank`) ensures kids near the bottom of their den see the achievement tier instead of a discouraging den ranking. Exception: dens with 2 or fewer racers always show rankings.

### Tier styling (implemented)

| Tier | Border Color | Ribbon | Extras |
|------|-------------|--------|--------|
| 1st Place | Gold `#c9950c` | Gold gradient | Medal emoji |
| 2nd Place | Silver `#94a3b8` | Slate gradient | Medal emoji |
| 3rd Place | Bronze `#c2410c` | Orange gradient | Medal emoji |
| Top 10 | Navy `#003F87` | Navy gradient | — |
| Den champion | Den accent color | Den-colored gradient | Den image (110px) |
| Den 2nd/3rd | Den accent color | Den-colored gradient | Den image (110px) |
| Achievement | Navy `#003F87` | Navy gradient | Den image (80px, if available) |

### Den accent colors (defined locally in certificate.tsx)

```ts
Lions: '#eab308', Tigers: '#ea580c', Wolves: '#2563eb',
Bears: '#dc2626', Webelos: '#4f46e5', AOLs: '#059669'
```

## Certificate Layout

Landscape orientation, print-optimized. Implemented in `certificate.tsx`:

```
┌─────────────────────────────────────────────────────────────┐
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    [Rope knot corners]           [Rope knot corners]        │
│  │                                                      │  │
│       ⚜  CUB SCOUTS OF AMERICA  ⚜                         │
│  │       CERTIFICATE OF ACHIEVEMENT                     │  │
│            ─────────────────                                │
│  │    This certificate is proudly presented to          │  │
│                                                             │
│  │             TOMMY SCOUT                              │  │
│               (racing font, 52px)                           │
│  │                                                      │  │
│          ┌──────────────────────────┐                       │
│  │       │   ⭐ Fastest Wolf! ⭐    │  (tier ribbon)    │  │
│          └──────────────────────────┘                       │
│  │                                                      │  │
│                 [den image]                                  │
│  │                                                      │  │
│       Wins  2nd  3rd  Best Time  Avg Time  Car #            │
│  │       4    2    1   3.214s    3.456s    #17           │  │
│                                                             │
│  │  Spring Derby 2026            ________________       │  │
│     March 15, 2026                  Cubmaster               │
│  │                                                      │  │
│    [Rope knot corners]           [Rope knot corners]        │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└─────────────────────────────────────────────────────────────┘
```

### Design elements

- **FleurDeLis SVG** — custom vector art flanking the title, colored to match tier
- **RopeKnotBorder** — decorative rope-style corner knots in tier color
- **Georgia serif** base font, `var(--font-racing)` (Anton) for name and headline
- **Warm paper background** `#fffdf7` with inner border line
- **Cubmaster signature line** — blank line with "Cubmaster" label (placeholder for handwritten signature)

### Print CSS

```css
@media print {
  .no-print { display: none !important; }
  body { margin: 0; padding: 0; background: white !important; }
  .certificate-page { page-break-after: always; padding: 12px 0 !important; }
  .certificate-page:last-child { page-break-after: auto; }
}
@page { size: landscape; margin: 0.4in; }
```

PDF export works via the browser's "Save as PDF" print option.

### Stats displayed

Zero-value stats are hidden (e.g., if a racer has 0 second-place finishes, that column is omitted):

- Wins (highlighted, larger text)
- 2nd Place count
- 3rd Place count
- Best Time
- Avg Time
- Car #

### Deviation from original plan

- **Car photo** is NOT displayed on the certificate. The plan's mockup included a car photo area, but it was omitted in implementation — the den image fills that visual role.
- **Achievement tier headline** uses "Pinewood Derby Racer" instead of "Certificate of Achievement" (which is the page title instead).
- **"Cub Scouts of America"** header was added above the title.

## Den Ranking Utilities

Implemented as a **separate file** `src/frontend/lib/den-rankings.ts` (not merged into `den-utils.ts` as originally planned). This separation keeps concerns clean — `den-utils.ts` handles asset imports, `den-rankings.ts` handles computation.

### Exports

```ts
// den-rankings.ts
denRankings<T>(standings, racers, den)     // filtered + sorted standings for a den
denPlacement<T>(standings, racers, racerId) // { rank, total, den } or null
shouldShowDenRank(rank, total)              // false if bottom 2 in den
```

The 3-argument signatures (standings + racers + den/racerId) differ from the original plan's 2-argument design because the `Standing` type doesn't carry den info — it must be looked up via the racers array.

### den-utils.ts

Exports `DEN_IMAGES` only (den name → imported PNG path). Unchanged from pre-certificate state.

## Racer Stats

### In certificate.tsx (standalone)

`computeStats()` is defined locally in `certificate.tsx` since it's a standalone bundle. Computes wins, 2nd/3rd place counts, best/avg time from the racer's heat history.

### In main app (shared)

`src/frontend/lib/racer-stats.ts` exports:
- `bestLane(history)` — determines the lane where a racer performed best (avg time, falls back to avg place)
- `computeRacerStats(results)` — same stats as the certificate version

Both files compute the same stats independently. The certificate bundle can't import from the main app's lib because it's a separate entry point.

## Integration Points

### Racer profile → Certificate link (Done)

`RacerProfileView.tsx` shows a certificate link in the top action bar:
```tsx
<a href={`/certificate/${racer.id}`} target="_blank">
  <Award /> Certificate
</a>
```
Only shown when the racer has standings data (has raced at least once).

### Race Console → Print All Certificates (Done)

`RaceConsoleView.tsx` shows a "Print All Certificates" link on the Race Complete screen (after all heats are finished), next to the "View Final Standings" button. Opens `/certificates` in a new tab.

### Racer profile → Den placement strip (Done, on `certificate-updates` branch)

A colored strip below the ProfileBanner showing within-den placement (e.g., "3rd in Wolves · of 8") using the den's accent color. Only shown for racers in the top half of their den via `shouldShowDenRank`.

## Remaining Work

### Standings view — within-den re-ranking
- The den filter dropdown exists and filters correctly
- **Not done:** When filtered to a den, positions should re-rank 1st/2nd/3rd within that den with gold/silver/bronze styling
- Currently shows overall rank numbers even when filtered

### Display / projector — Den Champions
- **Not done:** After showing overall standings, cycle through "Den Champions" — one slide per den showing the top 3 racers with den image and colors

### Sharing flow
- **Not done:** QR code on projector linking to `/certificates`
- **Not done:** Certificate icon-link per racer row in standings view
- **Done:** Racer profile certificate link
- **Done:** Race console "Print All Certificates" button

### Cleanup opportunities
- `DEN_ACCENT` is duplicated: defined in `certificate.tsx` and also in `den-utils.ts` on the `certificate-updates` branch. Should be consolidated into `den-utils.ts` and imported by both the main app and certificates (via shared lib).
- `computeStats` in `certificate.tsx` duplicates `computeRacerStats` in `racer-stats.ts`. Consider whether the certificate bundle could share this code without pulling in the full main app bundle.

## Future Enhancements

### Den champion certificates
The "Fastest Wolf!" callout is currently the strongest den-level recognition. Extend this pattern to generate dedicated den champion certificates — "1st Wolf", "2nd Bear", etc. — so every den's top finishers get a certificate that highlights their within-den achievement. These could be printed separately or included in the batch alongside overall certificates.

### Custom awards
Many packs give out non-racing awards voted on by judges, audience, or pack leadership. The software should support admin-defined custom awards that appear on certificates:

- **Most Creative** — best artistic design
- **Most Scout-Like** — best representation of scouting spirit
- **Best Paint Job** — standout finish or color scheme
- **Funniest Car** — humor award
- **Not a Car** — when the entry is a boat, airplane, hot dog, etc.
- **Best in Show** — audience favorite
- **Hardest Luck** — for the kid whose car broke but kept a great attitude

Implementation: an admin UI to create named awards, assign them to racers, and optionally attach a custom description. Awarded racers get an extra ribbon on their certificate with the award name. Custom awards don't affect race standings.

### Other enhancements
- **Custom signatures** — admin types "Cubmaster [Name]" that appears on all certificates (signature line placeholder already exists)
- **Event logo upload** — pack logo in the certificate header
- **QR code on certificate** — link back to the racer's profile page for digital keepsake
- **"Most Improved"** — track across multiple events if the same racer name appears
- **Den awards ceremony mode** — display page cycles through dens, revealing den champion with animation
- **Car photo on certificate** — was in original plan but omitted; could be added as an option
