# Tijori Finance MCP

**India's first MCP server for Indian equity research.**

Talk to 5,000+ NSE/BSE listed companies directly from Claude. Get financials, operational KPIs, revenue mix, market share trends, investor documents, and macro data — all in one conversation.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue?logo=anthropic)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-ISC-yellow)](LICENSE)
[![Data](https://img.shields.io/badge/Data-Tijori%20Finance-orange)](https://tijorifinance.com)

---

## What you can do

```
"Deep dive into HDFC Bank — financials, KPIs, market share, and latest concall"

"Screen for companies with ROE > 20%, debt-to-equity < 0.3, and market cap > 5000 Cr"

"How have Jio's subscriber metrics and ARPU trended over the last 3 years?"

"Get me the last 4 quarterly earnings releases for Reliance Industries"

"Which sectors are showing the strongest credit growth in India's macro data?"
```

---

## Why this exists

Most financial MCP servers are built for US markets — Yahoo Finance, SEC filings, S&P data. **Nothing existed for India.**

Tijori Finance is the most comprehensive source for Indian equity data — operational KPIs, revenue segment breakdowns, market share trends, and curated investor documents that aren't available anywhere else via API. This MCP server exposes all of it to Claude.

---

## Tools

| Tool | What it does |
|---|---|
| `search_company` | Search any company by name, get its slug |
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
| `list_popular_screens` | Browse pre-built stock screens |
| `screen_companies` | Screen stocks by any financial metric combination |
| `resolve_company_ids` | Resolve slug to numeric company ID |

---

## Requirements

- **Node.js v18+** — [nodejs.org](https://nodejs.org)
- **Tijori Finance account** (paid) — [tijorifinance.com](https://tijorifinance.com)
- **Claude Desktop** or VS Code with the Claude extension

---

## Setup

**1. Clone and configure**

```bash
git clone https://github.com/LaZZy0v0/tijori-finance-mcp.git
cd tijori-finance-mcp
cp .env.example .env
```

Edit `.env` with your Tijori credentials:

```
TIJORI_EMAIL=your@email.com
TIJORI_PASSWORD=yourpassword
```

**2. Install and authenticate**

```bash
npm run setup
```

This installs packages, downloads the Chromium browser (one-time, ~150MB), then opens a browser window for you to log in to Tijori Finance. Once logged in, your session is saved automatically and the browser closes.

**3. Add to Claude**

Edit your MCP config file and add the server. Use the **absolute path** to this repo.

**Claude Desktop on Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

**Claude Desktop on Mac** — `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tijori-finance": {
      "command": "node",
      "args": ["/absolute/path/to/tijori-finance-mcp/src/index.js"]
    }
  }
}
```

**4. Restart Claude Desktop**

Fully quit and reopen. The server starts automatically.

**5. Test it**

> *"Search for Tata Steel on Tijori"*

If Claude returns a result, you're connected.

---

## Session expiry

Tijori sessions expire periodically. When tools stop working, run:

```bash
npm run reauth
```

A browser window opens — log in, done.

---

## How it works

The server uses [Playwright](https://playwright.dev) to maintain an authenticated browser session with Tijori Finance. Each tool navigates to the relevant page or calls the underlying API endpoint, parses the response, and returns structured JSON to Claude. Results are cached in-memory (6 hours for financials, 30 minutes for metrics) to avoid redundant requests.

---

## Disclaimer

This project is not affiliated with Tijori Finance. It requires your own paid Tijori Finance subscription. Use it for personal research only — do not redistribute the underlying data.

---

*Built with [Model Context Protocol](https://modelcontextprotocol.io) · Powered by [Tijori Finance](https://tijorifinance.com)*
