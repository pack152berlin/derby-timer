# Authentication & Access Control Plan

Administrative access control for DerbyTimer — covering both local race-day use and cloud deployment.

## Status: Phase 1-3 Complete

## 1. Goal

*   **Admins**: Full access to registration, inspection, race control, and settings.
*   **Guests (Parents/Public)**: Read-only access to standings, schedules, displays, and certificates.
*   **Privacy option**: Optional viewer password so the entire site requires authentication — important for privacy-focused families who don't want their kids' names and photos on a public URL.
*   **Local-First Priority**: Easy to set up without an internet connection or complex user management.
*   **Cloud-Ready**: The same auth mechanism works identically when deployed to Fly.io for post-event sharing.

## 2. Technical Strategy: "Admin Key" (Shared Secret)

A shared secret approach — significantly easier for volunteers to manage than individual accounts, and works the same locally and in the cloud.

### A. The Admin Key

*   The server checks for a `DERBY_ADMIN_KEY` environment variable.
*   **Default (Public Mode)**: If `DERBY_ADMIN_KEY` is not set, the app defaults to "Public Mode" where all users are treated as admins. This is the race-day default for local networks — no setup friction.
*   **Explicit Key**: Set `DERBY_ADMIN_KEY` to a specific string for a persistent, known password.
*   **Secure Zero-Config (Auto)**: If `DERBY_ADMIN_KEY=auto`, the server manages a unique key:
    *   **Generation**: Creates a high-entropy random string on first run.
    *   **Persistence**: Saved to a file next to the database (e.g., `/data/.derby_admin_key` on Fly.io, `.derby_admin_key` locally). Server restarts don't log everyone out.
    *   **Manual Rotation**: Delete the key file and restart → new key, all sessions revoked.

### B. Viewer Password (Privacy Mode)

*   The server checks for a `DERBY_VIEWER_KEY` environment variable.
*   **Default (Open)**: If `DERBY_VIEWER_KEY` is not set, all read-only content (standings, certificates, display) is publicly accessible — the normal behavior.
*   **Password-Protected**: If `DERBY_VIEWER_KEY` is set, **every page** requires authentication. Unauthenticated visitors see a login page with a simple "Enter event password" prompt.
*   **Why**: Some families don't want their children's names and car photos on a public URL. The viewer password lets the pack leader share the URL and password privately (e.g., in a pack email or GroupMe) without exposing data to the open internet.

#### How It Works

*   **Two cookies, two tiers**: The existing `derby_admin` cookie grants full access. A second `derby_viewer` cookie grants read-only access. The admin cookie implicitly satisfies the viewer check too — admins don't need to enter the viewer password separately.
*   **Cookie value**: `HMAC-SHA256(viewer_key, "derby_viewer_session")` — same pattern as the admin cookie.
*   **Login endpoint**: `POST /viewer/login` accepts `{ password }` and sets the `derby_viewer` cookie.
*   **Middleware**: A `viewerRequired(handler)` wrapper checks for either `derby_admin` or `derby_viewer` cookie. Applied to all GET routes when `DERBY_VIEWER_KEY` is set.
*   **Display**: The `/display` route requires the viewer cookie like any other page. Projector setup requires logging in on the device first (future: add `?token=` param for keyboard-free setup).

#### Cloud Setup

```bash
fly secrets set DERBY_ADMIN_KEY=admin-password DERBY_VIEWER_KEY=viewer-password
```

The pack leader shares the viewer password with families. Anyone with the password can see standings and certificates. Without it, they see nothing.

#### Modes Summary

| `DERBY_ADMIN_KEY` | `DERBY_VIEWER_KEY` | Behavior |
|---|---|---|
| Not set | Not set | **Public mode** — full access, no auth (race-day default) |
| Set | Not set | **Admin-protected** — reads are public, writes require admin login |
| Set | Set | **Fully private** — both viewing and admin require passwords |
| Not set | Set | Invalid — server warns and ignores viewer key (no point without admin key) |

### C. Admin Distribution

**Local (race day):** Terminal QR code printed at startup. Volunteers scan to authenticate.
*   **QR Format**: `http://<local-ip>:3000/admin/login?token=SECRET_TOKEN`
*   Scanning opens a server endpoint that validates the token, sets an HttpOnly cookie, and `302` redirects to `/`. The token never lingers in the browser URL bar, history, or screenshots.

**Cloud (post-event):** The pack leader uses `fly secrets set DERBY_ADMIN_KEY=their-chosen-password`. They log in via a simple `/admin/login` page (see section 4).

### D. Storage & Persistence (Cookie-Based)

*   **Browser**: The server sets an `HttpOnly` cookie (`derby_admin=HMAC_HASH`) on successful login. The browser sends it automatically on every request.
*   **Why cookies over headers**: The codebase has ~25 standalone `fetch()` calls in `api.ts` with no shared wrapper. Retrofitting `Authorization` headers on every call is error-prone. Additionally, `<img src="/api/racers/:id/photo">` tags can't carry headers. Cookies are sent automatically on all requests, including WebSocket upgrades and image loads.
*   **Cookie value**: Instead of storing the raw admin key in the cookie, store an HMAC: `HMAC-SHA256(admin_key, "derby_admin_session")`. The server validates by recomputing the HMAC. This way the admin key itself is never in transit after the initial login.
*   **Cookie attributes**:
    *   `HttpOnly` — always (prevents JS access)
    *   `SameSite=Lax` — prevents CSRF on cross-origin requests
    *   `Secure` — set when the request came over HTTPS (detected via URL scheme or `X-Forwarded-Proto` header)
    *   `Path=/` — available on all routes
    *   `Max-Age=2592000` (30 days) — long session for post-event viewing
*   **Logout**: `POST /admin/logout` clears the cookie.

### E. Routes That Must Stay Public

These routes are always public when `DERBY_VIEWER_KEY` is **not** set. When it **is** set, they require the viewer (or admin) cookie:

*   `/display` — projector page (requires viewer cookie when viewer key is set)
*   `/certificate/:id` — parents view their kid's certificate
*   `/certificates` — batch view for printing
*   All `GET` endpoints: `/api/events`, `/api/events/:id/heats`, `/api/events/:id/standings`, `/api/racers/:id/photo`
*   `/ws` — WebSocket for live updates (viewer cookie validated on upgrade)

The only truly always-public routes (even with viewer key set):

*   `/viewer/login` — the viewer login page itself
*   `/admin/login` — the admin login page
*   `/admin/status` — auth status check (used by frontend)

## 3. Protected Areas

### UI (Frontend)

| View / Component | Guest Access | Admin Access |
| :--- | :--- | :--- |
| **Event List** (`/`) | View only (no create/delete) | Create / Delete |
| **Registration** (`/register`) | Admin-only page | Full access |
| **Heat Schedule** (`/heats`) | View only (no generate/clear/end) | Generate / Clear Heats |
| **Race Control** (`/race`) | Admin-only page | Start / Save Results |
| **Standings** (`/standings`) | Full access | Same |
| **Racer Profile** (`/racer/:id`) | View only | Edit details / photos |
| **Race Format** (`/format`) | View only | Same |
| **Display** (`/display`) | Full access | Same |
| **Certificate** (`/certificate/:id`) | Full access | Same |
| **Batch Certificates** (`/certificates`) | Admin-only page | Print all certificates |

Admin-only pages (Registration, Race Control, Batch Certificates) show a centered "Admin access required" message. Read-only pages (Events, Schedule) hide mutation buttons and show an "Admin access required" banner. In public mode (no key set), everything works as today — no banners, no restrictions.

### API (Backend)

*   **Route wrapping**: Wrap individual mutation handlers with an `adminOnly(handler)` higher-order function:
    ```ts
    "/api/heats/:id/start": { POST: adminOnly(startHeatHandler) }
    ```
*   **Validation**: `adminOnly` reads the `derby_admin` cookie, validates the HMAC against the server's key, returns `401 Unauthorized` if invalid.
*   **Rate limiting**: The `/admin/login` endpoint should be rate-limited (max 10 attempts per minute per IP) to prevent brute-force guessing. This is especially important when deployed publicly.

## 4. Implementation Steps

### Phase 1: Backend Auth Module

1. Implement `src/auth.ts`:
   - `getAdminKey()` — reads from `DERBY_ADMIN_KEY` env, or loads/generates from key file
   - `getViewerKey()` — reads from `DERBY_VIEWER_KEY` env (no auto-generation; explicit only)
   - `adminOnly(handler)` — cookie validation wrapper, returns `401` on failure
   - `viewerRequired(handler)` — checks for `derby_admin` or `derby_viewer` cookie; only active when viewer key is set
   - `setAdminCookie(res)` / `setViewerCookie(res)` / `clearCookies(res)` — cookie management
   - `isPublicMode()` — returns true when no admin key is configured
   - `isPrivateMode()` — returns true when viewer key is configured
2. Add routes:
   - `POST /auth/login` — unified login: accepts `{ password }`, checks admin key then viewer key, sets appropriate cookie
   - `GET /admin/login?token=...` — validates HMAC token, sets admin cookie, `302` redirects to `/`
   - `POST /admin/logout` — clears admin cookie
   - `POST /viewer/logout` — clears viewer cookie
   - `GET /admin/status` — returns `{ admin: true/false, viewer: true/false, publicMode: true/false, privateMode: true/false }`
3. Wrap all `POST`/`PATCH`/`DELETE` routes with `adminOnly()` except explicitly public ones
4. When `DERBY_VIEWER_KEY` is set, wrap all `GET` routes with `viewerRequired()` except login and healthcheck
5. Auto-discover local network IP; print QR code to terminal via `qrcode-terminal`

### Phase 2: Frontend Auth Context

1. Add `isAdmin`, `isViewer`, `isPublicMode`, and `isPrivateMode` to `AppContext`
2. On app load, call `GET /admin/status` to determine auth state
3. If `privateMode && !isViewer && !isAdmin`, show in-app `PrivateLoginGate` (full-screen login form)
4. No URL param handling needed — the cookie flow is entirely server-side

### Phase 3: Frontend UI Updates

1. Conditionally render action buttons (Start Heat, Generate, Delete) based on `isAdmin`
2. Show "Admin access required" banner on admin-only views when `!isAdmin && !isPublicMode`
3. In public mode (no key set), everything works as it does today — no banners, no restrictions

### Phase 4: Admin Login UI

1. Login dialog in the app shell (no separate `/admin` page):
   - "Admin Login" button in the nav bar opens a password dialog
   - Dialog POSTs to `/auth/login` — the unified endpoint checks admin key then viewer key
   - On success, the app refreshes auth state and shows admin controls
2. Local mode: QR code at `/admin/login?token=HMAC` is the primary login method for volunteers
3. Cloud mode: the nav bar password dialog is the primary login method

## 5. Cloud Deployment Considerations

### Setting the Admin Key on Fly.io

```bash
# Admin only (standings/certificates are public)
fly secrets set DERBY_ADMIN_KEY=your-chosen-password

# Admin + viewer (everything requires a password)
fly secrets set DERBY_ADMIN_KEY=admin-password DERBY_VIEWER_KEY=viewer-password
```

The `auto` admin key mode also works — the generated key persists on the Fly volume at `/data/.derby_admin_key`. The viewer key must be set explicitly (there's no `auto` mode for it — the pack leader chooses what to share with families).

### HTTPS & Cookie Security

*   Fly.io terminates TLS at the edge (`force_https = true` in `fly.toml`)
*   The `Secure` cookie flag should be set when `NODE_ENV=production`
*   The `X-Forwarded-Proto` header tells the app the original protocol

### Public vs Admin on the Cloud

When deployed, the app serves two or three audiences depending on configuration:

1. **Parents**: Visit the public URL. If `DERBY_VIEWER_KEY` is set, they enter the viewer password (shared by the pack leader via email/GroupMe). If not set, they see standings and certificates without logging in.
2. **Pack leader**: Logs in via `/admin` with the admin password to manage data if corrections are needed post-event.

The default post-event workflow is read-only — parents just view results. For privacy-conscious packs, set the viewer key so only families with the password can see names and photos.

### Database Security

The SQLite database sits on a Fly volume. Security layers:

1. **Network**: Fly machines are not SSH-accessible by default. Only the app process can read the DB.
2. **Auth**: Mutation API routes are admin-gated. A random internet user can only read standings/certificates.
3. **Backup**: Litestream to Tigris provides disaster recovery (see [Deployment Plan](./deployment.md)).
4. **Encryption at rest**: Not needed for derby results. If future events include PII beyond names, consider SQLCipher or Fly's encrypted volumes.

### What About Real User Accounts?

Not needed for the foreseeable future. The shared secret model covers the use cases:

- **Race day**: 2–4 volunteers share the admin key via QR code
- **Post-event**: Pack leader is the sole admin

If DerbyTimer ever supports multi-pack hosting or persistent web accounts, the `adminOnly` wrapper can be swapped to validate against an OAuth/OIDC provider (Google, GitHub) without changing the frontend's `isAdmin` dependency.

## 6. Testing Strategy

### Test Scripts

All test scripts set both keys and include the appropriate cookies in requests:

```bash
"test:integration": "DERBY_ADMIN_KEY=test-secret DERBY_VIEWER_KEY=test-viewer DERBY_DB_PATH=test-integration.db PORT=3099 bun src/index.ts & ..."
"test:ui": "DERBY_ADMIN_KEY=test-secret DERBY_DB_PATH=test-ui.db PORT=3001 bun src/index.ts & ..."
```

### Integration Tests (`tests/auth.integration.ts`)

*   `POST /api/heats/:id/start` without cookie → `401`
*   `POST /api/heats/:id/start` with valid admin cookie → `200`
*   `GET /admin/login?token=wrong` → `401`
*   `GET /admin/login?token=correct` → `302` + `Set-Cookie` with `HttpOnly`
*   `POST /auth/login` with admin password → `200` + `Set-Cookie` (`derby_admin`) + `role: "admin"`
*   `POST /auth/login` with viewer password → `200` + `Set-Cookie` (`derby_viewer`) + `role: "viewer"`
*   `GET /api/events` without cookie (no viewer key) → `200` (public read)
*   `GET /api/events` without cookie (viewer key set) → `401`
*   `GET /api/events` with viewer cookie (viewer key set) → `200`
*   `GET /api/events` with admin cookie (viewer key set) → `200` (admin implies viewer)
*   `POST /viewer/login` with correct password → `200` + `Set-Cookie` (`derby_viewer`)
*   `POST /viewer/login` with wrong password → `401`
*   Rate limiting: 11 rapid login attempts → `429` (applies to all login endpoints)
*   Cookie has `Secure` flag when request includes `X-Forwarded-Proto: https`

### E2E Tests (`e2e/auth.playwright.ts`)

*   **Guest Path**: Navigate to `/register`. See read-only view with "Admin required" banner.
*   **Admin Path**: Hit `/admin/login?token=HMAC`. Verify cookie is set, redirected to `/`, all actions available.
*   **Password Login**: Use "Admin Login" button in nav, submit password. Verify cookie is set via `/auth/login`.
*   **Logout**: Call `/admin/logout`. Verify admin actions disappear.
*   **Public Mode**: Start server without `DERBY_ADMIN_KEY`. Verify no banners, full access.
*   **Private Mode**: Start server with `DERBY_VIEWER_KEY=test-viewer`. Navigate to `/` — see `PrivateLoginGate`. Enter viewer password, verify events page loads.
*   **Private Mode Admin**: In private mode, admin cookie grants full access without needing viewer password.

## 7. Related Plans

*   **[Deployment Plan](./deployment.md)** — Fly.io deployment, SQLite persistence, Litestream backup
*   **[Achievement Certificate Plan](./achievement-certificate.md)** — certificate routes must stay public
*   **[Edge Cases Plan](./edge-cases.md)** — admin-only actions like void, withdraw, DQ
