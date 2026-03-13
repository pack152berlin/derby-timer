# Authentication & Access Control Plan

Administrative access control for DerbyTimer — covering both local race-day use and cloud deployment.

## Status: Not Started

## 1. Goal

*   **Admins**: Full access to registration, inspection, race control, and settings.
*   **Guests (Parents/Public)**: Read-only access to standings, schedules, displays, and certificates.
*   **Local-First Priority**: Easy to set up without an internet connection or complex user management.
*   **Cloud-Ready**: The same auth mechanism works identically when deployed to Fly.io for post-event sharing.

## 2. Technical Strategy: "Admin Key" (Shared Secret)

A shared secret approach — significantly easier for volunteers to manage than individual accounts, and works the same locally and in the cloud.

### A. The Admin Key

*   The server checks for a `DERBY_ADMIN_KEY` environment variable.
*   **Default (Public Mode)**: If `DERBY_ADMIN_KEY` is not set (or set to `none`), the app defaults to "Public Mode" where all users are treated as admins. This is the race-day default for local networks — no setup friction.
*   **Explicit Key**: Set `DERBY_ADMIN_KEY` to a specific string for a persistent, known password.
*   **Secure Zero-Config (Auto)**: If `DERBY_ADMIN_KEY=auto`, the server manages a unique key:
    *   **Generation**: Creates a high-entropy random string on first run.
    *   **Persistence**: Saved to a file next to the database (e.g., `/data/.derby_admin_key` on Fly.io, `.derby_admin_key` locally). Server restarts don't log everyone out.
    *   **Manual Rotation**: Delete the key file and restart → new key, all sessions revoked.

### B. Admin Distribution

**Local (race day):** Terminal QR code printed at startup. Volunteers scan to authenticate.
*   **QR Format**: `http://<local-ip>:3000/admin/login?token=SECRET_TOKEN`
*   Scanning opens a server endpoint that validates the token, sets an HttpOnly cookie, and `302` redirects to `/`. The token never lingers in the browser URL bar, history, or screenshots.

**Cloud (post-event):** The pack leader uses `fly secrets set DERBY_ADMIN_KEY=their-chosen-password`. They log in via a simple `/admin/login` page (see section 4).

### C. Storage & Persistence (Cookie-Based)

*   **Browser**: The server sets an `HttpOnly` cookie (`derby_admin=HMAC_HASH`) on successful login. The browser sends it automatically on every request.
*   **Why cookies over headers**: The codebase has ~25 standalone `fetch()` calls in `api.ts` with no shared wrapper. Retrofitting `Authorization` headers on every call is error-prone. Additionally, `<img src="/api/racers/:id/photo">` tags can't carry headers. Cookies are sent automatically on all requests, including WebSocket upgrades and image loads.
*   **Cookie value**: Instead of storing the raw admin key in the cookie, store an HMAC: `HMAC-SHA256(admin_key, "derby_admin_session")`. The server validates by recomputing the HMAC. This way the admin key itself is never in transit after the initial login.
*   **Cookie attributes**:
    *   `HttpOnly` — always (prevents JS access)
    *   `SameSite=Lax` — prevents CSRF on cross-origin requests
    *   `Secure` — set when `NODE_ENV=production` or when the request came over HTTPS
    *   `Path=/` — available on all routes
    *   `Max-Age=604800` (7 days) — reasonable session length for post-event viewing
*   **Logout**: `POST /admin/logout` clears the cookie.

### D. Routes That Must Stay Public

*   `/display` — projector page has no keyboard/mouse
*   `/certificate/:id` — parents view their kid's certificate
*   `/certificates` — batch view for printing
*   All `GET` endpoints used by display and certificates: `/api/events`, `/api/events/:id/heats`, `/api/events/:id/standings`, `/api/racers/:id/photo`
*   `/ws` — WebSocket for live updates (read-only broadcast)

## 3. Protected Areas

### UI (Frontend)

| View / Component | Guest Access | Admin Access |
| :--- | :--- | :--- |
| **Event List** (`/`) | View only | Create / Delete |
| **Registration** (`/register`) | Read-only with "Admin required" banner | Full access |
| **Heat Schedule** (`/heats`) | View only | Generate / Clear Heats |
| **Race Control** (`/race`) | Read-only with "Admin required" banner | Start / Save Results |
| **Standings** (`/standings`) | Full access | Same |
| **Racer Profile** (`/racer/:id`) | View only | Edit details / photos |
| **Race Format** (`/format`) | View only | Edit settings |
| **Display** (`/display`) | Full access | Same |
| **Certificates** (`/certificate/:id`, `/certificates`) | Full access | Same |

Prefer showing pages read-only with a subtle "Admin access required" banner over hard redirects. This is friendlier for parents who navigate to the wrong page.

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
   - `adminOnly(handler)` — cookie validation wrapper, returns `401` on failure
   - `setAdminCookie(res)` / `clearAdminCookie(res)` — cookie management
   - `isPublicMode()` — returns true when no key is configured
2. Add routes:
   - `GET /admin/login?token=...` — validates token, sets cookie, `302` redirects to `/`
   - `POST /admin/login` — accepts `{ password }` JSON body, validates, sets cookie (for the web login form)
   - `POST /admin/logout` — clears cookie
   - `GET /admin/status` — returns `{ admin: true/false, publicMode: true/false }`
3. Wrap all `POST`/`PATCH`/`DELETE` routes with `adminOnly()` except explicitly public ones
4. Auto-discover local network IP; print QR code to terminal via `qrcode-terminal`

### Phase 2: Frontend Auth Context

1. Add `isAdmin` and `isPublicMode` to `AppContext`
2. On app load, call `GET /admin/status` to determine auth state
3. No URL param handling needed — the cookie flow is entirely server-side

### Phase 3: Frontend UI Updates

1. Conditionally render action buttons (Start Heat, Generate, Delete) based on `isAdmin`
2. Show "Admin access required" banner on admin-only views when `!isAdmin && !isPublicMode`
3. In public mode (no key set), everything works as it does today — no banners, no restrictions

### Phase 4: Admin Login Page

1. Create a simple `/admin` page:
   - If `isPublicMode`: show "Public Mode — all users have admin access"
   - If `!isAdmin`: show a password input form (POST to `/admin/login`)
   - If `isAdmin`: show QR code for other volunteers, local IP, "Revoke All Sessions" button
2. Local mode: QR code is the primary login method
3. Cloud mode: password form is the primary login method

## 5. Cloud Deployment Considerations

### Setting the Admin Key on Fly.io

```bash
fly secrets set DERBY_ADMIN_KEY=your-chosen-password
```

This is the only auth-related deployment step. The `auto` mode also works — the generated key persists on the Fly volume at `/data/.derby_admin_key`.

### HTTPS & Cookie Security

*   Fly.io terminates TLS at the edge (`force_https = true` in `fly.toml`)
*   The `Secure` cookie flag should be set when `NODE_ENV=production`
*   The `X-Forwarded-Proto` header tells the app the original protocol

### Public vs Admin on the Cloud

When deployed, the app serves two audiences:

1. **Parents**: Visit the public URL, see standings and certificates. No login needed.
2. **Pack leader**: Logs in via `/admin` with the password to manage data if corrections are needed post-event.

The default post-event workflow is read-only — parents just view results. Admin access is only needed if the pack leader needs to fix a name, update a car number, or regenerate certificates.

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

All test scripts set `DERBY_ADMIN_KEY=test-secret` and include the admin cookie in requests:

```bash
"test:integration": "DERBY_ADMIN_KEY=test-secret DERBY_DB_PATH=test-integration.db PORT=3099 bun src/index.ts & ..."
"test:ui": "DERBY_ADMIN_KEY=test-secret DERBY_DB_PATH=test-ui.db PORT=3001 bun src/index.ts & ..."
```

### Integration Tests (`tests/auth.integration.ts`)

*   `POST /api/heats/:id/start` without cookie → `401`
*   `POST /api/heats/:id/start` with valid cookie → `200`
*   `GET /admin/login?token=wrong` → `401`
*   `GET /admin/login?token=correct` → `302` + `Set-Cookie` with `HttpOnly`
*   `POST /admin/login` with correct password → `200` + `Set-Cookie`
*   `GET /api/events` without cookie → `200` (public read)
*   Rate limiting: 11 rapid login attempts → `429`
*   Cookie has `Secure` flag when request includes `X-Forwarded-Proto: https`

### E2E Tests (`e2e/auth.playwright.ts`)

*   **Guest Path**: Navigate to `/register`. See read-only view with "Admin required" banner.
*   **Admin Path**: Hit `/admin/login?token=test-secret`. Verify cookie is set, redirected to `/`, all actions available.
*   **Password Login**: Submit password on `/admin` form. Verify cookie is set.
*   **Logout**: Call `/admin/logout`. Verify admin actions disappear.
*   **Public Mode**: Start server without `DERBY_ADMIN_KEY`. Verify no banners, full access.

## 7. Related Plans

*   **[Deployment Plan](./deployment.md)** — Fly.io deployment, SQLite persistence, Litestream backup
*   **[Achievement Certificate Plan](./achievement-certificate.md)** — certificate routes must stay public
*   **[Edge Cases Plan](./edge-cases.md)** — admin-only actions like void, withdraw, DQ
