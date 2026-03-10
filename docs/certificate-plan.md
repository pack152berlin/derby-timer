# Certificate Generation Plan

Printable achievement certificates for racers, accessible from the local network.

## Goal

After awards, every kid gets a certificate — either printed by a volunteer or pulled up on a parent's phone. Top 3 get placement certificates; everyone else gets a participation certificate. No new API endpoints needed — all data comes from existing GET routes.

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/certificate/:racerId` | Public | Single racer certificate (shareable link) |
| `/certificates` | Admin | Batch view — all racers for the current event, one per page |

Individual certificates are public so parents can view them on their own phones. The batch page is admin-only to avoid spoiling results before the awards ceremony.

## Data per Certificate

All available from existing endpoints (`GET /api/racers/:id`, `GET /api/events/:id/standings`, `GET /api/racers/:id/photo`):

- **Racer**: name, den, car number, car photo
- **Standing**: placement, wins, losses, best time
- **Event**: name, date

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
│  ║   placed                                       ║   │
│  ║            1st Place                           ║   │
│  ║                                                ║   │
│  ║   4 Wins  ·  Best Time: 3.214s                 ║   │
│  ║                                                ║   │
│  ║   ┌────────┐                                   ║   │
│  ║   │ car    │     Spring Derby 2026             ║   │
│  ║   │ photo  │     March 15, 2026                ║   │
│  ║   └────────┘                                   ║   │
│  ║                                                ║   │
│  ║   [navy #003F87 / crimson #CE1126 border]      ║   │
│  ╚═════════════════════════════════════════════════╝   │
└───────────────────────────────────────────────────────┘
```

### Tiered styling

- **1st place**: gold border accent, medal emoji, "1st Place" prominent
- **2nd place**: silver/slate accent
- **3rd place**: bronze/orange accent
- **All others**: "Certificate of Participation" — emphasizes wins and best time rather than rank

### Brand elements

- Navy `#003F87` + crimson `#CE1126` palette
- Anton / Rajdhani fonts (already loaded in the app)
- LilyChevron motifs as decorative elements
- Den images (`src/frontend/assets/dens/`) next to the den name

## Implementation

### 1. New entry point: `src/frontend/certificate.html` + `certificate.tsx`

A self-contained mini-app like `display.html` — isolated from the main SPA bundle. Keeps the certificate rendering out of the main bundle size.

### 2. `CertificateView.tsx`

- Reads `racerId` from URL path (single mode) or fetches all racers + standings (batch mode)
- Renders certificate template with print-optimized CSS
- Includes a "Print" button (hidden in print) and a "Back" link

### 3. Print CSS

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

### 4. Server route

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
- **Den-themed borders** — use den colors from the `DEN_BORDER` map for the certificate border
- **QR code on certificate** — link back to the racer's profile page for digital keepsake
