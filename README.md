# derby-timer

Derby race timer console built on [Bun](https://bun.com), the fast all-in-one JavaScript runtime, bundler, and server.

## Requirements

- Bun (required). Install from https://bun.com if you do not have it.

## Install

```bash
bun install
```

## Run (with HMR)

```bash
bun --hot index.ts
```

Then open `http://localhost:3000` in your browser.

## Docs

- Race day implementation plan: `docs/race-day-plan.md`

## Notes

- Bun serves the UI and API from `index.ts`.
- The frontend bundle is `index.html` + `frontend.ts` + `styles.css`.
- State is in-memory for now and resets on restart.
