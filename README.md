# derby-timer

## Install

```bash
bun install
```

## Run (with HMR)

```bash
bun --hot index.ts
```

Then open `http://localhost:3000` in your browser.

## Notes

- Bun serves the UI and API from `index.ts`.
- The frontend bundle is `index.html` + `frontend.ts` + `styles.css`.
- State is in-memory for now and resets on restart.
