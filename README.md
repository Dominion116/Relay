# Relay

> **Pay-per-use information infrastructure for AI agents & developers, settled in USDC on Base via the x402 protocol.**
> Built for [Vibeathon 02: Night Shift](https://app.vibestarter.xyz/vibeathon) on [@base](https://x.com/base).

[![Base Network](https://img.shields.io/badge/Network-Base%20L2-0052FF)](https://base.org)
[![USDC Payment](https://img.shields.io/badge/Settlement-USDC%20Microtransactions-2775CA)](https://circle.com/usdc)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402%20v2-91D982)](https://x402.org)
[![MCP Enabled](https://img.shields.io/badge/Claude%2FAnthropic-MCP%20Ready-black)](https://modelcontextprotocol.io)

---

## ⚡ The Architecture: Native Autonomous Micropayments on Base

Modern AI agents require on-demand access to real-world data (scholarly research, weather forecasts, market rates, and geocoding). Traditional APIs require human credit cards, monthly recurring commitments, and manual API key provisioning.

**Relay brings native autonomous micro-commerce to Base (Coinbase L2):**
1. **The Native Home of x402:** The x402 protocol was created at Coinbase specifically for EVM microtransactions and agent commerce.
2. **ERC-3009 Gasless Payments:** Official Base USDC supports `transferWithAuthorization`. Agents and users sign an off-chain EIP-712 typed signature; zero ETH gas is required from the consumer.
3. **Autonomous Agent Integration:** Fully compatible with Coinbase AgentKit, CDP Wallets, LangChain, and Claude via our included Model Context Protocol (MCP) server.

---

## 🎯 12 Live Endpoints & Pricing

Every endpoint returns structured, normalized JSON. Discovery is available at `/.well-known/x402`.

| # | Endpoint | Description | Provider | Price (USDC) |
|---|---|---|---|---|
| 1 | `POST /v1/academic/search` | Search scholarly papers with DOIs & citation metrics | OpenAlex | **$0.08** (80,000 units) |
| 2 | `POST /v1/academic/work` | Retrieve single scholarly work by DOI | OpenAlex | **$0.06** (60,000 units) |
| 3 | `POST /v1/crypto/price` | Spot prices and 24h percentage changes | CoinGecko | **$0.04** (40,000 units) |
| 4 | `POST /v1/crypto/market` | Market caps, rank, volume, and supplies | CoinGecko | **$0.06** (60,000 units) |
| 5 | `POST /v1/fx/rates` | Official ECB reference exchange rates | Frankfurter | **$0.04** (40,000 units) |
| 6 | `POST /v1/weather` | Current conditions and 3-day forecast | Open-Meteo | **$0.05** (50,000 units) |
| 7 | `POST /v1/geocode` | Forward & reverse geocoding to GPS coordinates | Photon / OSM | **$0.04** (40,000 units) |
| 8 | `POST /v1/holidays` | Public holiday dates and nationwide observance | Nager.Date | **$0.04** (40,000 units) |
| 9 | `POST /v1/knowledge/search` | Structured Wikidata entity IDs and descriptions | Wikidata | **$0.06** (60,000 units) |
| 10 | `POST /v1/news/search` | Real-time global news headlines and source domains | News Aggregator | **$0.08** (80,000 units) |
| 11 | `POST /v1/research` | Multi-source deterministic evidence pack | Synthesizer | **$0.10** (100,000 units) |
| 12 | `POST /v1/verify` | Explainable claim verification heuristic | Lexical Engine | **$0.12** (120,000 units) |

---

## 🔄 The x402 Protocol Flow on Base

```
Client / AI Agent                  Relay Gateway                  Base L2 Network
       │                                │                                │
       ├───── 1. POST (No Auth) ───────►│                                │
       │                                │                                │
       │◄──── 2. HTTP 402 Challenge ────┤                                │
       │      (USDC Amount, Nonce,      │                                │
       │       Base Merchant Address)   │                                │
       │                                │                                │
       ├─ 3. Sign EIP-712 Auth (USDC) ──┤                                │
       │                                ├──── 4. Verify & Settle ───────►│
       │                                │◄─── 5. Confirmed (TxHash) ─────┤
       │                                │                                │
       │◄──── 6. HTTP 200 OK ───────────┤                                │
       │      (Data Payload + Receipt)  │                                │
```

### Official Base USDC Contract Addresses:
- **Base Mainnet (Chain ID 8453):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia (Chain ID 84532):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 🤖 Claude Desktop & Cursor MCP Integration

Relay is equipped with an out-of-the-box **Model Context Protocol (MCP)** server. You can enable Claude to query live real-world information and pay per call directly on Base.

Add this block to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "relay": {
      "command": "npx",
      "args": ["-y", "@relay/mcp-server"],
      "env": {
        "BASE_NETWORK": "base",
        "BASE_PRIVATE_KEY": "YOUR_AGENT_WALLET_KEY",
        "MAX_DAILY_BUDGET_USDC": "5.00"
      }
    }
  }
}
```

---

## 💻 Quick Start & Local Run

### Prerequisites:
- Node.js 18+ (tested on Node v24)
- npm 10+

### Installation & Execution:
```bash
# Clone and enter directory
git clone https://github.com/relay/relay.git
cd relay

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to test the interactive playground, inspect the 402 challenges, and run live queries.

### Build for Production:
```bash
npm run build
```

---

## 🚀 1-Click Deployment (Vercel / Render / Cloudflare)

This repository includes a pre-configured `vercel.json` file. To deploy and generate the live URL required for Vibeathon 02:

```bash
# Using Vercel CLI
npx vercel deploy --prod
```

---

## 🏆 Vibeathon 02 Judging Alignment

- **Execution (30%):** Fully functional end-to-end. 12 working data endpoints, live HTTP 402 challenge negotiation, Base EIP-712 verification engine, and interactive testbench.
- **Launch Potential (25%):** Solves the single greatest bottleneck for AI agents: having to create human credit card accounts and API keys just to fetch simple live data.
- **Originality (20%):** Pioneers the first complete Base-native x402 data marketplace, providing programmatic micropayment access to verified data without subscriptions.
- **Craft & UX (15%):** Unslopped design according to Damir Sokolovsky's craft methodology: Ink neutral ramp, hairlines, tabular figures, no glows or gradients.
- **Vibecoding Leverage (10%):** Native Model Context Protocol (MCP) server ready for Claude Pro and Cursor vibecoders.
