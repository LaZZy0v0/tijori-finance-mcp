# Architecture & Tribal Knowledge

This document exists so that any future session — human or model — inherits what was learned building this server instead of re-deriving it. Most of what's below was discovered by driving the live site, capturing its network traffic, and reading its JavaScript; very little of it is guessable from the code alone.

Last updated: 2026-06-12.

---

## 1. What this is

An **unofficial** MCP server for Tijori Finance (tijorifinance.com), a paid Indian-equities research platform. There is no public API. Everything works by impersonating a logged-in browser: a Playwright Chromium holds the user's Django session cookies and either (a) scrapes pages or (b) calls the same internal `/api/...` endpoints the site's own frontend calls.

**The core architectural principle: the architecture is whatever the website does.** When a tool misbehaves, the fix is never to guess — it's to watch what the site sends (network capture) or read the site's own JS (`/static/js/filters.js` etc.) and replicate it exactly.

```
Claude Desktop ⇄ stdio (JSON-RPC) ⇄ src/index.js (MCP server, 19 tools)
                                         │
                                   src/tools/*  ── parsers (src/parsers/*)
                                         │
                                   src/browser.js (ONE shared headless Chromium)
                                         │     cookies from output/session.json
                                   tijorifinance.com (pages + internal /api/)
```

## 2. Module map

| File | Role |
|---|---|
| `src/index.js` | MCP server; registers all tools with zod schemas. `wrap()` converts throws into `{error, message}` results. |
| `src/browser.js` | The transport. Singleton browser + context, nav semaphore, resource blocking, `loadPage`/`withPage`/`browserFetch`/`withContext`. |
| `src/auth.js` | Reads `output/session.json`, builds cookie/CSRF headers (for non-browser fetches). |
| `src/cache.js` | In-memory TTL map. TTLs: FINANCIALS/SHAREHOLDING 6h, MACRO/RAW_MATERIALS 1h, METRICS 30m, MARKETS 15m, SEARCH 5m. |
| `src/helpers.js` | `resolveCompanyIds(slug)` — regexes company_id/name/symbol out of an inline `<script>` JSON blob on the company page. |
| `src/tools/*` | One file per domain: search, company, financials, shareholding, metrics, market, screener. |
| `src/parsers/*` | DOM → JSON for scraped pages. |
| `discover.js` | Auth flow (`--reauth` opens a visible browser for manual login) + endpoint discovery. |
| `test/test_screener.js` | 26 live assertions against the real site. Run: `node test/test_screener.js`. |
| `setup.js` / `setup.bat` / `setup.command` | Cross-platform setup wizard + double-click launchers (Windows / Mac). `.gitattributes` pins `setup.command` to LF, `setup.bat` to CRLF; the exec bit on `setup.command` is set in the git index so GitHub zips arrive runnable. |

## 3. The transport layer (src/browser.js) — why it is the way it is

Every decision here was a response to a production failure:

- **One browser, lazy-launched.** A cold burst of parallel tool calls used to launch several Chromiums and orphan most of them. `_initPromise` makes concurrent callers join one launch.
- **Nav semaphore (`MAX_CONCURRENT_NAV = 3`).** A "full workup" query fans out ~7 heavy page loads; uncapped, they starve each other and all hit timeout together.
- **`waitUntil: 'domcontentloaded'`, NEVER `'networkidle'`.** Tijori polls live prices forever; `networkidle` never fires. `'load'` was also too slow because of trackers — which is why...
- **Resource blocking.** Images/media/fonts and trackers (mixpanel, partytown, GA, twitter embeds) are aborted at the route level. The site's own JS and `/api` XHRs pass through, so client-rendered sections still build. `context.request`/`page.request` bypass routing, so direct API fetches are unaffected.
- **`waitFor` selector contract.** `loadPage(url, { waitFor })` returns only when the selector that the parser needs has rendered — complete data or a clear error, never a half-loaded page. Without `waitFor` it falls back to a 1.5s settle.
- **One retry on navigation timeout**, everything else bubbles.
- **`browserFetch(url)`** = open page on BASE_URL (so cookies are in scope), run in-page `fetch` with credentials, JSON-parse if possible. 403 ⇒ `SESSION_EXPIRED`, 404 ⇒ `NOT_FOUND`. **If it returns a string, you got an HTML error page** — treat as failure (the screener does this check).

## 4. Auth & session

- `output/session.json` is a Playwright `storageState` containing Django cookies (`sessionid`, `csrftoken`), captured by `node discover.js --reauth` (manual login in a visible browser, 3-minute window).
- Any 403 anywhere ⇒ surface `{ error: "SESSION_EXPIRED", message: "Run: node discover.js --reauth" }`. Don't retry.
- The browser context and `auth.js` both present the same Chrome-on-Windows User-Agent; keep them consistent — Cloudflare fronts the site.

## 5. Tool inventory (19 registered)

| Tool | Mechanism |
|---|---|
| `search_company` | GET `/api/v1/ind/company_search/?q=` (NOT `/api/search/`) |
| `resolve_company_ids` | scrape inline script JSON on `/company/{slug}/` |
| `get_company_overview` | scrape `/company/{slug}/` (`.custom_ratio` selectors) |
| `get_financials` | scrape, type-aware section selectors (pl/bs/cf/ratios/quarterly) |
| `get_shareholding` | scrape 10-quarter table |
| `get_operational_metrics` | GET `/api/v1/ind/company_op_metrics/{id}/{sectorId}/` |
| `get_fund_flow` | GET `/api/v1/ind/fund_flow_analysis_data/{id}/` (returns all periods; filter by years 1/3/5/7/10) |
| `get_raw_materials`, `get_macro_indicators`, `get_markets` | scrape tab pages; parsers carry unit + depth hierarchy + null alignment |
| `get_sector_constituents`, `get_conglomerate_constituents` | by `tjiid` from `get_markets` |
| `get_knowledge_base` | document URLs grouped by type |
| `fetch_document` | PDF text via authenticated session (bypasses CDN ACLs); pdf-parse v1.1.1 pinned, its console noise redirected to stderr |
| `get_revenue_mix`, `get_market_share` | scrape; market_share returns empty+note when a company has none (most non-lenders) instead of erroring — prevents assistant retry loops |
| `list_popular_screens`, `screen_companies`, `search_screener_fields` | see §6 |

`analyze_portfolio` is listed in the README's v2 table but is **not implemented / not registered** — documented aspiration, not code.

## 6. The screener (the most nuance-dense area)

### Endpoints

| Endpoint | Used for | Notes |
|---|---|---|
| `GET /api/filter_queries/advanced_search/` | ad-hoc screens | params: `financial`, `alternate`, `is_checked`, `whales`, `is_sme`, `columns`, `source=Basic`, `query_id=null`. Returns **ALL** matching rows, unpaginated. |
| `GET /api/filter_queries/popular-query/results/` | presets | same params but `source=Popular` and a **real** `query_id` (server resolves the saved query; errors with `query_id=null`). |
| `GET /api/filter_queries/filter_field_search/?q=&query_type=financials` | field catalog | empty `q` returns the full ~3,308-entry catalog: 1,561 Financials + 1,460 Products + 287 Regions. |

### Traps (each cost real debugging time)

1. **Unknown query params are silently ignored.** The page URL calls the alternate query `aq`, but the API expects `alternate`. Sending `aq=` produces results that *look* right (the financial filter still applies) with the alternate filter silently dropped. This is the single most dangerous behavior in the whole API: **wrong param name = plausible wrong answer, not an error.**
2. **Popular-screens page hrefs contain RAW newlines, spaces, and `%` signs.** `new URL(href)` *deletes* newlines per the URL spec, fusing `AND` to the next field name (`ANDROCE`) — every query parsed that way is corrupt. Parse `getAttribute('href')` manually; `decodeURIComponent` can throw on raw `%` (e.g. `ROCE > 20%`), so wrap it (`safeDecode`).
3. **`filter_field_search` with non-empty `q` searches ONLY Financials and 404s on anything else** (`q=pharma` → 404 even though Pharmaceuticals is in the catalog). Therefore: fetch the full catalog once (empty `q`), cache 6h, search locally.
4. **Result keys embed HTML**: `"<span>latest</span>Mcap<span>Cr</span>"`. Strip tags from keys (`stripSpans`).
5. **The mainboard total caps at 5,000** (server-side cap on the count, ~the real universe size). SME universe is separate (~1,050), toggled by `is_sme`.

### Query languages

**Financial query** (`financial=`): exact field names from the catalog (`value` field is the literal token — `ROCE`, `3yr Avg ROCE`, `10Yrs ago PAT`); `%` values (`ROCE > 20%`); field-vs-field (`Net Sales > 3Yrs ago Net Sales`); arithmetic (`capex/Net Block > 0.5`, `1.68 * (...)`); `AND`/`and` both work; newlines ≡ spaces. Time-period variants per metric: present_val, average/cagr × 1/3/5/7/10yr, lastyear, val_Nyrs_ago, last/latest quarter, q-on-q, yoy-q.

**Alternate (business-data) query** (`alternate=`): grammar extracted from the site's `filters.js` — relationships `makes <product>`, `revenue from <product|region> [> N]`, `market share [<entity>] > N`, `uses <product>`, `caters to <product>`, `has plant in <region>`; connectors AND/OR, modifier NOT, parens. Entity names are the catalog's Products/Regions entries (Regions: 287 — continents, countries, blocs like EMEA/SAARC, Indian states, even US cities). Entity autocomplete on the site: `filter_field_search/?q=...&query_type=alternate_data&entity_types=Products,Productsp,Regions`.

**Checkbox flags** → params: "Only companies with latest results" → `is_checked`, "Has Superstar investors" → `whales` (adds a `whales` column naming the holder; valid as the *only* filter), "Is SME" → `is_sme`. Values are `'True'`/`'False'` strings.

### Design decisions in `src/tools/screener.js`

- **Progressive disclosure:** the 3,308-field catalog never enters Claude's context. `search_screener_fields` is the search handle (≤60 matches); the tool descriptions teach the query grammar by example.
- **Cache the FULL row set per query+flags; paginate by slicing.** The API returns everything anyway, so `offset`/`limit` page from cache — "next 50" never re-hits Tijori. Truncated responses carry a note with the exact next offset.
- **Presets must run through `popular-query/results/`** (that's what makes alternate-query presets like Monopoly Companies work). Preset matching: exact name, then substring, case-insensitive; on miss, the error lists all available names.
- `METRIC_MAP` (~40 shorthand aliases) is a convenience for the object filter form only — any exact catalog name works in query strings.
- DOM scrape of `/filter/popular-queries/`: walk `.popular_query_title` (category headers) and `.query_card` (name/description/Run-Query href) in document order so cards inherit their heading.

## 7. Context-budget philosophy (why caps exist everywhere)

MCP responses land in the model's context. Rules of thumb used throughout: default 50 rows (`limit`, max 500) + `total_results` + next-offset note; field search caps at 60; empty results return a note, never an error (errors make assistants retry in loops). When adding a tool, always ask "what's the worst-case response size?" — the API will happily return 1,900 rows.

## 8. Operational knowledge

- **stdout is sacred** (stdio MCP). All diagnostics → stderr. pdf-parse's internal logging had to be redirected during parsing for exactly this reason.
- **Claude Desktop must be fully restarted** (quit, not window-close) to pick up server code changes.
- Windows dev box; repo also targets Mac/Linux users. Watch line endings (`.gitattributes`) and remember `git update-index --chmod=+x` for new shell scripts.
- Exploration workflow that works: throwaway `explore_*.js` scripts using `src/browser.js` helpers to capture `page.on('request'/'response')` traffic or dump DOM; for submit logic, fetching the site's own JS (e.g. `filters.js`) and grepping it beats fighting chip-based UI widgets with Playwright. Delete the scripts after recording findings here. The user is also happy to "be the eyes" (DevTools screenshots/network captures) — often faster than headless automation.
- Output artifacts: `output/all_screener_fields.json` is a cached dump of the full field catalog (useful for offline reference); `output/session.json` is the live session — never commit it.

## 9. Known gaps / future work

- **Basic "Stock Screener" tab** (structured industry/location/raw-material checkbox filters) is not replicated. Industry filtering is partially achievable via alternate `makes <product>` queries.
- **Saved Screens / Public Screens** tabs: not implemented (no endpoints discovered yet).
- **`analyze_portfolio`**: in README, not in code.
- Alternate-query entities aren't validated client-side; a typo'd product name returns empty results rather than an error (consistent with the site).
- Field catalog "Productsp" entity type (seen in filters.js) is unexplored — likely product *sub-categories*.
