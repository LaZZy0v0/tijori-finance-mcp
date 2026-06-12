# Tijori Finance MCP — Claude Code instructions

Unofficial MCP server exposing Tijori Finance (tijorifinance.com, Indian equities) to Claude via a Playwright-authenticated browser session. **Read `docs/ARCHITECTURE.md` before changing anything non-trivial — it records the API behaviors, traps, and design decisions that were expensive to discover.**

## Hard rules

- **Never write to stdout** in server code (`console.log`, stray prints). stdout *is* the MCP stdio channel; one stray line corrupts the protocol. Use `process.stderr.write` for diagnostics. (This has bitten before: pdf-parse's console output had to be redirected to stderr.)
- **Never use `waitUntil: 'networkidle'`** — Tijori polls live prices forever; the page never goes idle. Use `domcontentloaded` + a `waitFor` selector that proves the data rendered.
- **After any code change, Claude Desktop must be fully quit and reopened** to reload the server. Tell the user.
- `pdf-parse` is pinned to v1.1.1 — v2.x broke the function export. Don't bump it.
- API responses embed HTML in JSON keys (`<span>latest</span>Mcap<span>Cr</span>`) — always strip tags from keys before returning (see `stripSpans` in `src/tools/screener.js`).

## Quick facts

- Session cookie: `output/session.json` (Playwright storageState). 403 ⇒ tell user to run `node discover.js --reauth`.
- Screener live tests: `node test/test_screener.js` (26 assertions against the live site; needs valid session).
- One shared headless Chromium, lazy-launched, max 3 concurrent navigations (`src/browser.js`).
- Tijori universe: ~5,000 mainboard (server caps the count at 5000) + ~1,050 SME.

## Working style that works here

To understand an undocumented Tijori behavior: write a throwaway `explore_*.js` that drives the real site with `src/browser.js` helpers and captures network calls (or fetch the site's own JS, e.g. `filters.js`, and read it) — then **replicate exactly what the site sends, never guess params** (unknown query params are *silently ignored*, which produces wrong-but-plausible results). Delete exploration scripts after committing findings to `docs/ARCHITECTURE.md`.
