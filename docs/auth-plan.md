# Authentication & Access Control Plan

This document outlines the strategy for implementing administrative access control in DerbyTimer.

## 1. Goal
*   **Admins**: Full access to registration, inspection, race control, and settings.
*   **Guests (Parents/Public)**: Read-only access to standings, schedules, displays, and certificates on the local network.
*   **Local-First Priority**: Easy to set up without an internet connection or complex user management.
*   **Web Scalability**: Can be extended to multi-user or web-hosted environment, especially for printing certificates.

## 2. Technical Strategy: "Admin Key" (Shared Secret)

We will use a **Shared Secret** approach. It is significantly easier for volunteers to manage than individual accounts.

### A. The Admin Key
*   The server checks for a `DERBY_ADMIN_KEY` environment variable.
*   **Default (Public Mode)**: If `DERBY_ADMIN_KEY` is not set (or set to `none`), the app defaults to "Public Mode" where all users are treated as admins.
*   **Explicit Key**: Set `DERBY_ADMIN_KEY` to a specific string for a persistent, known password.
*   **Secure Zero-Config (Auto)**: If `DERBY_ADMIN_KEY=auto`, the server manages a unique key for the lifetime of the event:
    *   **Generation**: If no key exists, it generates a high-entropy random string.
    *   **Persistence**: The key is saved to a local file (e.g., `.derby_admin_key`) in the project root or next to the database. This ensures that **server restarts do not log everyone out**.
    *   **Manual Rotation**: To revoke all current sessions and generate a new key, the operator simply deletes the `.derby_admin_key` file and restarts the server.
*   **Terminal QR Code**: When a key is set (explicitly or via `auto`), the server prints the onboarding URL and an ASCII QR code to the terminal at startup.

### B. Admin Distribution (The QR Code)
*   The primary server operator (on the laptop connected to the track) can access a special "Auth" view or see a QR code in the terminal.
*   **QR Format**: `http://<local-ip>:3000/admin/login?token=SECRET_TOKEN`
*   Scanning this QR code opens a server endpoint that validates the token, sets an HttpOnly cookie, and `302` redirects to `/`. The token never lingers in the browser URL bar, history, or screenshots.

### C. Storage & Persistence (Cookie-Based)
*   **Browser**: The server sets an `HttpOnly` cookie (`derby_admin=SECRET`) on successful login. The browser sends this automatically on every request — no frontend code changes needed.
*   **Why cookies over headers**: The codebase has ~25 standalone `fetch()` calls in `api.ts` with no shared wrapper. Retrofitting `Authorization` headers on every call is tedious and error-prone. Additionally, `<img src="/api/racers/:id/photo">` tags cannot carry headers — photos would break. Cookies are sent automatically by the browser on all requests, including WebSocket upgrades and image loads.
*   **Logout**: Clear the cookie (frontend can call `POST /admin/logout` or just delete the cookie).

### D. Routes That Must Stay Public
*   `/display` — projector page has no keyboard/mouse to present a login flow
*   `/certificate/:id` — parents view their kid's certificate on their own phone
*   All `GET` endpoints used by display and certificates: `/api/events`, `/api/events/:id/heats`, `/api/events/:id/standings`, `/api/racers/:id/photo`
*   `/ws` — WebSocket for live updates (read-only broadcast, no write commands)

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
| **Certificates** (`/certificate/:id`) | Full access | Same |
| **Batch Certificates** (`/certificates`) | Hidden | Print all |

Prefer showing pages read-only with a subtle "Admin access required" banner over hard redirects. This is friendlier for parents who navigate to the wrong page.

### API (Backend)
*   **Route wrapping**: Bun.serve's `routes` object does not support middleware. Instead, wrap individual mutation handlers with an `adminOnly(handler)` higher-order function:
    ```ts
    "/api/heats/:id/start": { POST: adminOnly(startHeatHandler) }
    ```
*   **Validation**: `adminOnly` reads the `derby_admin` cookie from the request, compares to the server's key, returns `401 Unauthorized` if missing/incorrect.
*   **Rate limiting**: The `/admin/login` endpoint should be rate-limited (e.g. max 10 attempts per minute per IP) to prevent brute-force guessing.

## 4. Implementation Steps

1.  **Backend (Auth Module & Startup)**:
    *   Implement `src/auth.ts` — manages the key (read from `DERBY_ADMIN_KEY` or generate), provides `adminOnly(handler)` wrapper, handles cookie set/clear.
    *   Auto-discover the local network IP address at startup.
    *   Integrate `qrcode-terminal` to print the onboarding URL to stdout.
    *   Add `GET /admin/login?token=...` — validates token, sets cookie, redirects.
    *   Add `POST /admin/logout` — clears cookie.
    *   Wrap all `POST`/`PATCH`/`DELETE` routes with `adminOnly()` except the explicitly public ones.
2.  **Frontend (Context)**:
    *   Add `isAdmin` boolean to `AppContext` (check cookie existence on load via a `GET /admin/status` endpoint that returns `{ admin: true/false }`).
    *   No URL param handling needed — the cookie flow is entirely server-side.
3.  **Frontend (UI Updates)**:
    *   Conditionally render nav items based on `isAdmin`.
    *   Show/hide action buttons (Start Heat, Generate, Delete) based on `isAdmin`.
    *   Show "Admin access required — scan QR to unlock" banner on admin-only views when `!isAdmin`.
4.  **Admin Portal**:
    *   Create a simple `/admin` route that displays the QR code for other volunteers to scan.
    *   Show active session count, local IP, and a "Revoke All Sessions" button (rotates the key).

## 5. Testing Strategy

### Test Scripts
All test scripts must set `DERBY_ADMIN_KEY=test-secret`:
```bash
"test:integration": "DERBY_ADMIN_KEY=test-secret DERBY_DB_PATH=test-integration.db PORT=3099 bun src/index.ts & ..."
"test:ui": "DERBY_ADMIN_KEY=test-secret DERBY_DB_PATH=test-ui.db PORT=3001 bun src/index.ts & ..."
```

### Integration Tests (`tests/auth.integration.ts`)
*   `POST /api/heats/:id/start` without cookie → `401`.
*   `POST /api/heats/:id/start` with valid cookie → `200`.
*   `GET /admin/login?token=wrong` → `401`.
*   `GET /admin/login?token=correct` → `302` + `Set-Cookie`.
*   `GET /api/events` without cookie → `200` (public read).
*   Rate limiting: 11 rapid login attempts → `429`.

### E2E Tests (`e2e/auth.playwright.ts`)
*   **Guest Path**: Navigate to `/register`. See read-only view with "Admin required" banner.
*   **Admin Path**: Hit `/admin/login?token=test-secret`. Verify cookie is set, redirected to `/`, "Registration" fully interactive in nav.
*   **Logout**: Clear cookie. Verify admin actions disappear.
*   **Security**: Verify the token is not visible in the URL after redirect. Verify `Set-Cookie` has `HttpOnly` flag.

## 6. Scaling to Web
For a hosted web version, the "Shared Secret" can be replaced by:
*   A "Login" page that validates against the same secret (backed by the same cookie mechanism).
*   Future: Real OIDC/OAuth providers (Google, GitHub) by swapping the `adminOnly` validation logic without changing the UI's `isAdmin` dependency.

## 7. Related Plans

*   **[Certificate Generation](./certificate-plan.md)** — printable achievement certificates for racers, accessible as a public route. Auth plan must keep certificate routes public.
