---
description: DerbyTimer - Pinewood Derby race management with Bun, shadcn/ui, and projector-optimized UI
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests. Create comprehensive test files that describe how the API works.

### Test script rules

The `test`, `test:integration`, and `test:ui` scripts start a server before running. **Never use `sleep N` to wait for the server.** Use a curl health-check loop instead:

```bash
# Good: wait until server is actually ready
PORT=3000 bun src/index.ts & until curl -sf http://localhost:3000/api/events > /dev/null; do sleep 0.2; done && bun test ./tests/api.test.ts; kill $!

# Bad: arbitrary sleep that causes flaky tests
PORT=3000 bun src/index.ts & sleep 2 && bun test ./tests/api.test.ts && kill $!
```

As an autonomous agent, do not modify the `test`, `test:integration`, or `test:ui` scripts in `package.json` unless the task explicitly instructs you to change those scripts.

### Test File Partitioning

- **Bun Tests** - Use `.test.ts` for unit tests and `.integration.ts` for integration tests.
- **Playwright Tests** - Use `.playwright.ts` for all E2E and screenshot capture tests.
- **Why?** This prevents the built-in `bun test` runner from attempting to execute browser-specific code, which causes unhandled errors.

### Interaction Selectors & data-testid

- **Standardized Targeting** - Every interactive element (buttons, cards, switches, links) must have a unique `data-testid` attribute.
- **Rigor** - Avoid selecting elements by text labels, generic HTML roles, or CSS classes in E2E tests.
- **Why?** Using `data-testid` ensures that tests remain stable even if the UI text changes or the app is translated.

```ts#tests/api.test.ts
import { describe, expect, it, beforeAll, afterAll } from "bun:test";

describe("DerbyTimer API", () => {
  it("should create an event", async () => {
    const response = await fetch("http://localhost:3000/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Derby", date: "2026-02-15", lane_count: 4 }),
    });
    expect(response.status).toBe(201);
  });
});
```

## Frontend - shadcn/ui & Tailwind

Use shadcn/ui components as the foundation. Add components with:

```bash
bunx shadcn add <component>
```

Preferred components: `button`, `card`, `input`, `badge`, `tabs`, `dialog`, `select`, `table`, `tooltip`

Always use Tailwind utility classes over custom CSS:

```tsx
// Good: Tailwind utilities
<div className="flex items-center gap-4 p-6 bg-slate-50 rounded-xl border-2 border-slate-200">

// Bad: Custom CSS
<div className="my-custom-card">
```

**Never use empty divs as spacers.** Use `justify-between`, `justify-end`, `ml-auto`, or `gap-*` instead:

```tsx
// Good
<div className="flex items-center justify-between">
  <div>Left</div>
  <Button>Right</Button>
</div>

// Bad
<div className="flex items-center">
  <div>Left</div>
  <div className="flex-1"></div>  {/* ❌ spacer div */}
  <Button>Right</Button>
</div>
```

## Design Principles - Projector-Optimized & "Derp" UX

**Target: Elementary school volunteers under mild chaos**

### Visual Design for Accessibility
- **Light mode only** - projects better, easier to read in lit rooms
- **High contrast** - slate-900 text on white backgrounds minimum
- **Large typography on Display Pages** - text-xl minimum for headers, text-lg for content
- **Minimum font size** - `text-xs` (12px) is the smallest allowed text size anywhere in the UI. Never use `text-[10px]`, `text-[9px]`, or any smaller size — even for labels, badges, or secondary info.
- **Bold weights** - font-bold, font-black for emphasis
- **Brand palette** — navy `#003F87` for active states and primary CTAs; crimson `#CE1126` for accent stripes and warning badges. Do not introduce orange or other brand colors.

### "Derp" UX - Foolproof Simplicity
- **One action per screen** - don't overwhelm users
- **Big buttons** - h-12 (48px) minimum for primary standalone CTAs; compact inline card actions (e.g. Save/Cancel/Edit in a list row) may use h-9
- **Clear labels** - no icons without text labels for primary actions; compact inline icon-only actions must have `aria-label` and `title`
- **Confirmation dialogs** for destructive actions (delete, clear)
- **Visual feedback** - loading states, success badges, clear status indicators
- **No nested navigation** - flat structure, tabs for sub-sections
- **Event context always visible** - show current event name prominently

### Layout
- **Max-width containers** - max-w-7xl for main content
- **Generous spacing** - gap-4 minimum between elements on desktop; tighter gap-3/py-3 acceptable on mobile for dense list views
- **Card-based organization** - use Card components to group related info
- **Sticky navigation** - keep nav visible at top
- **Mobile-first registration** - Registration is the most mobile-critical view; volunteers add racers on phones. Compact card layout (h-9 actions, stacked columns) is intentional

## Server

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

## Domain & Race Context

- **Manual Setup** - Race day logistics (staging cars, moving them to the track) are manual processes managed by volunteers. The software must accommodate the slow, physical nature of these steps.
- **Local Network Setup** - Volunteers will be using their phones for registration and for lane setup. Smaller fonts and mobile accessibility are important. Parents and other can access public pages. Dedicated display pages will be created for projector use. 
- **Car-to-Lane Integrity** - Maintaining the exact relationship between a car and its assigned lane for each heat is critical. Results are tied directly to the lane number where the car finished. During lane setup, car photos are essential for error detection. They allow volunteers to visually confirm that the physical car in a lane matches the digital record, helping them identify and correct staging errors before the race begins.

## Data Model Simplicity

Keep the data model flat and simple:
- **Merged entities** - racers include car info (no separate cars table)
- **Minimal fields** - only what's absolutely necessary
- **No categories/classes** - keep it simple for single-track racing
- **Direct relationships** - avoid complex many-to-many where possible

```typescript
// Simple racer with car info
interface Racer {
  id: string;
  name: string;
  den: string | null;
  car_number: string;
  weight_ok: number;
}
```

## Frontend Patterns

### Scrollable Lists with Sticky Headers

When a list needs vertical scrolling, place the header **outside** the `overflow-y-auto` container. Never put a sticky header inside a scroll container — it causes the scrollbar to overlap the header.

```tsx
// Good
<div className="overflow-hidden rounded-xl border border-slate-200">
  <HeaderRow />                          {/* outside scroll */}
  <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
    {rows.map(r => <Row key={r.id} {...r} />)}
  </div>
</div>

// Bad
<div className="overflow-y-auto rounded-xl border border-slate-200">
  <HeaderRow className="sticky top-0" /> {/* scrollbar overlaps header */}
  {rows.map(r => <Row key={r.id} {...r} />)}
</div>
```

### Performance for Sorted / Filtered Lists

When a list supports sorting or filtering and contains many rows, wrap the row component in `React.memo` and stabilize callbacks with `useCallback`. This lets React reorder DOM nodes without re-rendering unchanged rows.

```tsx
const Row = React.memo(function Row({ item, onAction }: RowProps) { ... });

function List({ items }: { items: Item[] }) {
  const handleAction = useCallback((id: string) => { ... }, []);
  return items.map(item => <Row key={item.id} item={item} onAction={handleAction} />);
}
```

Do **not** reach for `useDeferredValue` as a first fix — it defers scheduling but doesn't skip expensive renders. Memoization is the right tool for list rows.

### Shared Frontend Utilities

Place shared constants, formatters, and small helpers in `src/frontend/lib/`. Import from there rather than duplicating across views.

Examples of things that belong in `src/frontend/lib/`:
- `PLACE_STYLES` — place-number → Tailwind class map
- `DEN_IMAGES` — den name → imported image asset map
- `ordinal(n)` — number to "1st / 2nd / 3rd" string

## Type Management & Domain Boundaries

- **Separation of Concerns** - Never import backend database models or repository interfaces (from `src/db/**`) into frontend components.
- **Shared Types** - Use `src/frontend/types.ts` as the single source of truth for interfaces shared across views and the API client.
- **API Mapping** - The frontend API client (`src/frontend/api.ts`) is responsible for mapping backend response shapes (e.g., SQLite 0/1 integers) to frontend-friendly types (e.g., booleans).
- **Type Safety** - Avoid the use of `any` in API methods. Every request should have a defined return type.

## Git & Workflow Rigor

- **Pre-Edit Verification** - Before creating a new file, always check if a similar file already exists using `glob` or `list_directory`. Never assume a path is free.
- **Inclusive Commits** - Lean toward grouping all related changes (UI, backend, and tests) into a single logical commit. Avoid fragmented micro-commits for a single feature.
- **Message Quality** - Commit messages must be **clear but concise**. Focus on *intent* rather than listing files.
- **Self-Review** - Review every proposed commit message before execution. Strip filler words and ensure it provides high signal for other developers.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Simplicity and offline

The whole thing needs to run without internet, and be super simple for an agent to code and for a human to setup an event.
