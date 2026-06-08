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
"Pull Zomato's last 6 quarters of revenue and EBITDA margin, then read their
latest concall transcript — are they hitting the targets management guided for?"

"Bajaj Finance's FII stake dropped 400bps last year while promoters held flat —
pull their latest investor presentation to figure out if this is distribution or passive rotation."

"Crude is up — check the raw materials data for chemical spreads, then pull
revenue mix and operational metrics for Deepak Nitrite to see if margins are at risk."
```

<video src="https://github.com/user-attachments/assets/15e976d9-872a-494d-8aea-ce369de9cd01" controls muted autoplay loop width="100%"></video>

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

| Feature | **Tijori Finance MCP** | Traditional Research | Bloomberg / Refinitiv |
|---|---|---|---|
| **Setup Time** | 5 minutes | Hours (Python, Excel...) | Weeks (Contracts) |
| **Cost** | Free + Tijori subscription | Variable | $30k+/year |
| **Indian Market Coverage** | ✅ 5,000+ NSE/BSE stocks | ❌ Fragmented / manual | Partial |
| **Operational KPIs** | ✅ Segment data, KPIs, market share | ❌ Manual scraping | ✅ Proprietary |
| **Concall Transcripts** | ✅ Earnings calls, investor docs | ❌ PDF hunting | Partial |
| **AI-Ready Output** | ✅ Structured JSON → Claude | ❌ Unstructured pages | ❌ Proprietary only |
| **API Keys Required** | None | Multiple (OpenAI, etc.) | N/A |

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
| `get_sector_constituents` | All stocks inside a TJI niche sector index. Pass `tjiid` from `get_markets("niche")`. Returns slug, market-cap weight, and 1D–10Y price returns per stock |
| `get_conglomerate_constituents` | All companies inside a business group. Pass `tjiid` from `get_markets("conglomerates")`. Returns slug and 1D–10Y price returns per stock |
| `resolve_company_ids` | Resolve slug to numeric company ID |

### v2 — In Development

| Tool | What it does |
|---|---|
| `list_popular_screens` | Browse Tijori's pre-built stock screens (Dividend Superstars, Cash Flow Machines, etc.) |
| `screen_companies` | Screen 5,000+ stocks by any financial metric — ROE, PE, debt, margins, growth, and more |
| `analyze_portfolio` | Pass a list of company slugs — get back sector distribution, weighted avg PE/ROE/OPM, forensics spread, and promoter pledge flags across the whole portfolio |

> v2 tools are functional but not yet stable — expect occasional breakage.

---

## Setup

### Requirements

- [Node.js v18+](https://nodejs.org) — install the **LTS** version
- A [Tijori Finance](https://tijorifinance.com) account
- [Claude Desktop](https://claude.ai/download)

---

### Option 1 — Wizard (recommended)

The setup script handles everything automatically: installs packages, downloads the browser, authenticates, and writes the Claude Desktop config for you.

**Windows**

1. [Download Node.js](https://nodejs.org) and install it (choose LTS)
2. [Download Claude Desktop](https://claude.ai/download) and install it
3. [Download this repo](https://github.com/LaZZy0v0/tijori-finance-mcp/archive/refs/heads/master.zip) and unzip it anywhere
4. Double-click **`setup.bat`** inside the folder
5. Follow the prompts — enter your Tijori email/password, then log in through the browser window that opens
6. **Fully quit and reopen Claude Desktop**

**Mac / Linux**

```bash
git clone https://github.com/LaZZy0v0/tijori-finance-mcp.git
cd tijori-finance-mcp
node setup.js
```

Follow the prompts, then fully quit and reopen Claude Desktop.

---

### Option 2 — Manual

For those who want to see exactly what each step does.

**1. Clone and set credentials**

```bash
# Mac / Linux
git clone https://github.com/LaZZy0v0/tijori-finance-mcp.git
cd tijori-finance-mcp
cp .env.example .env

# Windows
git clone https://github.com/LaZZy0v0/tijori-finance-mcp.git
cd tijori-finance-mcp
copy .env.example .env
```

Open `.env` in any text editor and fill in your Tijori credentials:

```env
TIJORI_EMAIL=your@email.com
TIJORI_PASSWORD=yourpassword
```

**2. Install packages and browser**

```bash
npm install
npx playwright install chromium
```

`npm install` downloads the Node.js dependencies. `playwright install chromium` downloads a ~150 MB Chromium browser used to maintain your Tijori session — one-time only.

**3. Authenticate**

```bash
node discover.js
```

A browser window opens at the Tijori Finance sign-in page. Log in as you normally would. Once you're in, the script visits a few pages in the background to capture API endpoints, then the window closes automatically. Your session is saved to `output/session.json`.

**4. Configure Claude Desktop**

Find your config file and add the block below. The path to `src/index.js` **must be absolute**.

| OS | Config file location |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Mac | `~/Library/Application Support/Claude/claude_desktop_config.json` |

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

**5. Fully quit and reopen Claude Desktop**

---

### Test it

> *"Search Tata Steel using Tijori MCP"*

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

