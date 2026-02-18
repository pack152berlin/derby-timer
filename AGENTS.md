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

## Design Principles - Projector-Optimized & "Derp" UX

**Target: Elementary school volunteers under mild chaos**

### Visual Design for Projection
- **Light mode only** - projects better, easier to read in lit rooms
- **High contrast** - slate-900 text on white backgrounds minimum
- **Large typography** - text-xl minimum for headers, text-lg for content
- **Bold weights** - font-bold, font-black for emphasis
- **Orange accent color** (#f97316) for CTAs and highlights

### "Derp" UX - Foolproof Simplicity
- **One action per screen** - don't overwhelm users
- **Big buttons** - h-12 (48px) minimum for all actions
- **Clear labels** - no icons without text labels
- **Confirmation dialogs** for destructive actions (delete, clear)
- **Visual feedback** - loading states, success badges, clear status indicators
- **No nested navigation** - flat structure, tabs for sub-sections
- **Event context always visible** - show current event name prominently

### Layout
- **Max-width containers** - max-w-7xl for main content
- **Generous spacing** - gap-4 minimum between elements
- **Card-based organization** - use Card components to group related info
- **Sticky navigation** - keep nav visible at top

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

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Simplicity and offline

The whole thing needs to run without internet, and be super simple for an agent to code and for a human to setup an event.
