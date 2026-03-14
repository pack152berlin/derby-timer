# Plan: GitHub Pages Static Deployment

## Problem
DerbyTimer is a full-stack Bun monolith (React frontend + SQLite backend + WebSocket). GitHub Pages only serves static files — no server-side code. We need to decouple the frontend build and replace the server-side data layer with a client-side alternative.

## Architecture Overview

```
Current:  Browser → Bun.serve() → SQLite
Static:   Browser → IndexedDB (all data local in browser)
```

The static version will be a fully functional, offline-capable PWA where all data lives in the browser's IndexedDB. No backend needed.

---

## Step-by-Step Plan

### 1. Add Vite as the frontend build tool
- Install `vite`, `@vitejs/plugin-react`, and `vite-plugin-tailwindcss`
- Create `vite.config.ts` with path aliases (`@/` → `src/frontend/`) to match existing tsconfig
- Configure `base: '/derby-timer/'` for GitHub Pages subdirectory serving
- Entry point: `src/frontend/index.html` (already exists)
- Add `build` and `dev` scripts to package.json

### 2. Create a client-side storage adapter using IndexedDB
- Create `src/frontend/storage/` module with an IndexedDB-backed implementation
- Model the same entities: events, racers, heats, results
- Implement the same interface as the existing `api.ts` exports
- Use a feature flag / build-time env var (`VITE_STATIC_MODE`) to switch between:
  - **Server mode** (existing): fetch from `/api/*`
  - **Static mode** (new): read/write IndexedDB
- The heat planning algorithm (`src/race/heat-planner.ts`) is pure logic with no Bun dependencies — it can be imported directly into the frontend build

### 3. Adapt the React app for static deployment
- Switch `BrowserRouter` → `HashRouter` when in static mode (GitHub Pages doesn't support SPA history routing without hacks)
- Remove WebSocket dependency in static mode (not needed — single user, data is local)
- Handle photo uploads via `URL.createObjectURL()` + IndexedDB blob storage instead of server upload
- Auth/login features can be skipped in static mode (no server to authenticate against)
- The `/display` projector route can open in a new tab using cross-tab IndexedDB access

### 4. Add GitHub Actions workflow for GitHub Pages deployment
- New file: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main`
- Steps:
  1. Checkout code
  2. Install Bun (`oven-sh/setup-bun@v2`)
  3. `bun install`
  4. `bun run build` (Vite build with `VITE_STATIC_MODE=true`)
  5. Deploy `dist/` to GitHub Pages using `actions/deploy-pages@v4`
- Uses the free `github-pages` environment (no cost)

### 5. Enable GitHub Pages in repo settings
- The workflow uses the newer "GitHub Actions" source for Pages (not the branch-based approach)
- Requires `actions/configure-pages@v5` + `actions/upload-pages-artifact@v3` in the workflow

---

## What stays the same
- The existing `bun start` server mode is untouched — no breaking changes
- All existing tests continue to work against the server version
- The static build is an **additional** deployment target, not a replacement

## What the static version supports
- Creating events, registering racers
- Generating heats (uses the same pure-TS algorithm)
- Recording race results
- Viewing standings, racer profiles
- Certificate generation
- All data persists in browser IndexedDB (survives refresh, browser close)

## What the static version does NOT support
- Multi-device sync (no server to relay data)
- WebSocket real-time updates (single-browser, not needed)
- Hardware K1 timer integration (requires serial port + server)
- Server-side authentication

## File changes summary
| Action | File |
|--------|------|
| Create | `vite.config.ts` |
| Create | `src/frontend/storage/indexeddb.ts` |
| Create | `src/frontend/storage/index.ts` (adapter switch) |
| Modify | `src/frontend/api.ts` (conditional import) |
| Modify | `src/frontend/main.tsx` (HashRouter for static) |
| Modify | `package.json` (add vite deps + build script) |
| Create | `.github/workflows/deploy-pages.yml` |

## Cost
- **$0** — GitHub Pages is free for public repos, GitHub Actions has 2,000 free minutes/month
