<div align="center">

![Tijori Finance MCP](docs/Hero.png)

# Tijori Finance MCP

**India's first MCP server for Indian equity research.**

Talk to 5,000+ NSE/BSE listed companies directly from Claude.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-5A67D8?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-F59E0B)](LICENSE)
[![Data](https://img.shields.io/badge/Powered%20by-Tijori%20Finance-EA580C)](https://tijorifinance.com)
[![Status](https://img.shields.io/badge/Status-Active-22C55E)]()

</div>

---


## What you can do

```
"Deep dive into HDFC Bank — financials, KPIs, market share, and latest concall"

"Screen for companies with ROE > 20%, debt-to-equity < 0.3, and market cap > 5000 Cr"

"How have Jio's subscriber metrics and ARPU trended over the last 3 years?"

"Get me the last 4 quarterly earnings releases for Reliance Industries and summarize them"

"Which sectors are showing the strongest credit growth in India's macro data?"
```

---

> *"The goal is to turn data into information, and information into insight."*
> — Carly Fiorina

---

## In Action

### 1 — Cross-tool deep dive: Titan
*Revenue mix pulled first, then cross-referenced against P&L data to explain trends*

![Titan — Revenue Mix × P&L](docs/demos/01-titan-revenue-pl.png)

---

### 2 — IndiGo: P&L history
*Full income statement history retrieved in one call — revenue, EBITDA, PAT across years*

![IndiGo — P&L History](docs/demos/02-interglobe-pl.png)

---

### 3 — Concall → Financial projection
*Knowledge base fetched the latest earnings call transcript, Claude read it and built a forward projection model*

![Concall → Financial Projection](docs/demos/05-concall-projection.png)

---

## Why this exists

Most financial MCP servers are built for US markets — Yahoo Finance, SEC filings, S&P data.

**Nothing existed for India.**

Tijori Finance is the most comprehensive source for Indian equity data — operational KPIs, revenue segment breakdowns, market share trends, and curated investor documents that aren't available anywhere else. This MCP server exposes all of it to Claude.

<details>
<summary><strong>What makes this different from a web search?</strong></summary>

A web search gives you unstructured pages. This gives Claude **structured, queryable data** — historical time series, typed fields, and consistent schemas across all 5,000+ companies. Claude can reason over it, compare across companies, and build analyses — not just summarize a webpage.

</details>

---

## Tools

### v1 — Stable

| Tool | What it does |
|---|---|
| `search_company` | Search any company by name, returns slug |
| `get_company_overview` | Key ratios, forensics score, market cap, PE, ROE, ROCE |
| `get_financials` | P&L, Balance Sheet, Cash Flow, Ratios, Quarterly results |
| `get_shareholding` | 10-quarter promoter / FII / DII / public breakdown |
| `get_operational_metrics` | All operational KPIs with full historical time series |
| `get_fund_flow` | Capital allocation breakdown over 1/3/5/7/10 years |
| `get_revenue_mix` | Segment breakdown with historical trend per segment |
| `get_market_share` | Market share % per metric with as-of date |
| `get_knowledge_base` | Annual reports, earnings releases, investor presentations, conference calls |
| `get_raw_materials` | Commodity price performance — chemicals, spreads, metals |
| `get_macro_indicators` | India macro — credit, IIP, GST, auto sales, GDP, trade |
| `get_markets` | Index performance — Nifty, sector indices, conglomerates |
| `resolve_company_ids` | Resolve slug to numeric company ID |

### v2 — New

| Tool | What it does |
|---|---|
| `list_popular_screens` | Browse Tijori's pre-built stock screens (Dividend Superstars, Cash Flow Machines, etc.) |
| `screen_companies` | Screen 5,000+ stocks by any financial metric — ROE, PE, debt, margins, growth, and more |
| `get_sector_constituents` | All stocks inside a TJI niche sector index. Pass `tjiid` from `get_markets("niche")`. Returns slug, market-cap weight, and 1D–10Y price returns per stock |
| `get_conglomerate_constituents` | All companies inside a business group. Pass `tjiid` from `get_markets("conglomerates")`. Returns slug and 1D–10Y price returns per stock |
| `analyze_portfolio` | Pass a list of company slugs — get back sector distribution, weighted avg PE/ROE/OPM, forensics spread, and promoter pledge flags across the whole portfolio |

> `screen_companies` and `list_popular_screens` depend on Tijori's filter engine — expect occasional breakage after Tijori updates.

---

## Setup

### Requirements

- [Node.js v18+](https://nodejs.org)
- A paid [Tijori Finance](https://tijorifinance.com) account
- [Claude Desktop](https://claude.ai/download) or VS Code with the Claude extension

### 1. Clone and configure

```bash
git clone https://github.com/LaZZy0v0/tijori-finance-mcp.git
cd tijori-finance-mcp
cp .env.example .env
```

Edit `.env` with your Tijori credentials:

```env
TIJORI_EMAIL=your@email.com
TIJORI_PASSWORD=yourpassword
```

### 2. Install and authenticate

```bash
npm run setup
```

This does three things:
- Installs Node packages
- Downloads Chromium (~150MB, one-time only)
- Opens a browser for you to log in to Tijori Finance — once logged in, the session is saved and the browser closes

### 3. Connect to Claude

Find your MCP config file and add the block below. The path **must be absolute**.

<details>
<summary><strong>Claude Desktop — Windows</strong></summary>

File: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tijori-finance": {
      "command": "node",
      "args": ["C:/Users/yourname/tijori-finance-mcp/src/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop — Mac</strong></summary>

File: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tijori-finance": {
      "command": "node",
      "args": ["/Users/yourname/tijori-finance-mcp/src/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong></summary>

Add to your Claude extension MCP settings:

```json
{
  "tijori-finance": {
    "command": "node",
    "args": ["/absolute/path/to/tijori-finance-mcp/src/index.js"]
  }
}
```

</details>

### 4. Restart Claude and test

Fully quit and reopen Claude Desktop. Then try:

> *"Search for Tata Steel on Tijori"*

If Claude returns a result, you're connected.

---

## Session expiry

Tijori sessions expire periodically. When tools stop working:

```bash
npm run reauth
```

A browser window opens — log in manually and you're back.

---

## How it works

The server uses [Playwright](https://playwright.dev) to maintain an authenticated browser session with Tijori Finance. Each tool navigates to the relevant page or calls the underlying API, parses the response, and returns structured JSON to Claude. Results are cached in-memory (6 hours for financials, 30 minutes for metrics) to keep things fast.

![Architecture](docs/Arch.png)

---

## Disclaimer

This project is not affiliated with Tijori Finance. It requires your own paid Tijori Finance subscription. Use for personal research only — do not redistribute the underlying data.

---

<div align="center">

*Built with [Model Context Protocol](https://modelcontextprotocol.io) · Data from [Tijori Finance](https://tijorifinance.com)*

</div>

