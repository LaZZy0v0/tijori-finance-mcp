<div align="center">

<!-- HERO BANNER -->
<!-- Replace with: docs/banner.png — see Gemini prompt at bottom of this file -->
<!-- Recommended: 1280x640px, dark background, India skyline + data viz aesthetic -->
![Tijori Finance MCP](https://placehold.co/1280x400/0f172a/f97316?text=Tijori+Finance+MCP&font=montserrat)

# Tijori Finance MCP

**India's first MCP server for Indian equity research.**

Talk to 5,000+ NSE/BSE listed companies directly from Claude.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-5A67D8?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-ISC-F59E0B)](LICENSE)
[![Data](https://img.shields.io/badge/Powered%20by-Tijori%20Finance-EA580C)](https://tijorifinance.com)
[![Status](https://img.shields.io/badge/Status-Active-22C55E)]()

</div>

---

<!-- DEMO GIF -->
<!-- Replace with: docs/demo.gif — record a 30-45 second screen capture -->
<!-- Show: asking Claude "deep dive into HDFC Bank" → tools firing → rich output -->
<!-- Tool to record: OBS Studio (free) or Loom, export as GIF via ezgif.com -->
> 📹 **Demo coming soon** — replace this block with `![Demo](docs/demo.gif)` after recording

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

### v2 — In Development

| Tool | What it does |
|---|---|
| `list_popular_screens` | Browse Tijori's pre-built stock screens (Dividend Superstars, Cash Flow Machines, etc.) |
| `screen_companies` | Screen 5,000+ stocks by any financial metric — ROE, PE, debt, margins, growth, and more |

> These tools are functional but depend on Tijori's filter engine. Expect occasional breakage after Tijori deploys updates.

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

<!-- ARCHITECTURE DIAGRAM -->
<!-- Replace with: docs/architecture.png — see Gemini prompt at bottom of this file -->
<!-- Show: Claude → MCP Server → Playwright browser → Tijori Finance, with cache layer -->

---

## Disclaimer

This project is not affiliated with Tijori Finance. It requires your own paid Tijori Finance subscription. Use for personal research only — do not redistribute the underlying data.

---

<div align="center">

*Built with [Model Context Protocol](https://modelcontextprotocol.io) · Data from [Tijori Finance](https://tijorifinance.com)*

</div>

---

<details>
<summary><strong>Image generation prompts (Gemini / Imagen)</strong></summary>

**Hero banner** (`docs/banner.png`, 1280×400px):
```
A wide cinematic banner for a developer tool called "Tijori Finance MCP". Dark navy background (#0f172a). 
On the left, a glowing abstract visualization of stock market data — candlestick charts, line graphs, 
numbers flowing — in orange and blue tones. On the right, subtle outlines of the Mumbai skyline. 
In the center, clean modern sans-serif text "Tijori Finance MCP" in white. 
Tagline below in smaller text: "India's first MCP server for Indian equity research". 
Professional fintech aesthetic, no people, no logos.
```

**Architecture diagram** (`docs/architecture.png`, 900×400px):
```
A clean minimal technical architecture diagram on a dark (#0f172a) background. 
Four boxes connected with arrows left to right: 
1. "Claude" (purple box with Anthropic logo style), 
2. "MCP Server" (blue box, Node.js), 
3. "Playwright Browser" (green box), 
4. "Tijori Finance" (orange box). 
A "Cache" cylinder below the MCP Server box connected with a bidirectional arrow. 
Clean white labels, rounded corners, subtle glow effects. Minimalist developer diagram style.
```

**Demo screenshot** (`docs/screenshot.png`) — take this yourself:
- Ask Claude: *"Get me a full analysis of HDFC Bank — overview, operational metrics, and revenue mix"*
- Screenshot the Claude response showing multiple tool calls firing and the structured output
- Crop to 1280×800px

</details>
