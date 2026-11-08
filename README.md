# Relay

[![Network: Base](https://img.shields.io/badge/Network-Base%20Mainnet%20%7C%20Sepolia-0052FF.svg)](https://base.org)
[![Protocol: x402 v2](https://img.shields.io/badge/Protocol-x402%20v2-blue.svg)](https://x402.org)
[![Settlement: USDC](https://img.shields.io/badge/Settlement-USDC%20(ERC--3009)-2775CA.svg)](https://circle.com/usdc)
[![Tests](https://img.shields.io/badge/Tests-181%20passing-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Checked-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Open pay-per-use data and capability infrastructure for autonomous AI agents on Base. Reviving HTTP status code `402 Payment Required` with gasless EIP-712 micropayments in native USDC.

---

## Overview

Relay solves the fundamental barrier preventing autonomous software from purchasing internet resources: **AI agents cannot hold credit cards, submit KYC documents, or commit to monthly recurring SaaS subscriptions**.

By implementing the canonical **x402 v2** micropayment protocol with native USDC on Base, Relay allows AI agents, Model Context Protocol (MCP) servers, and developers to pay per request with sub-cent settlement and zero human intervention.

```
┌────────────────────────┐        ┌────────────────────────┐        ┌────────────────────────┐
│    Autonomous Agent    │  ────▶ │     Relay Gateway      │  ────▶ │   Upstream Providers   │
│   (SDK / MCP / Viem)   │  ◀──── │  (x402 Verification)   │  ◀──── │  (CoinGecko/OpenAlex)  │
└────────────────────────┘        └────────────────────────┘        └────────────────────────┘
            │                                 │
            │ 1. EIP-712 Sign                 │ 2. Submit & Settle
            ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                       Base Blockchain (Primer Systems Facilitator)                         │
│                     ERC-3009 TransferWithAuthorization in Micro-USDC                       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

- ✅ **Machine-Native Micropayments**: Pay strictly per call in micro-cents ($0.04 – $0.12 USDC) without subscription locks or credit cards.
- ✅ **Canonical x402 v2 Protocol**: Full wire compliance with standard `PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers.
- ✅ **100% Gasless for Agent Wallets**: Powered by the Primer Systems public x402 facilitator (`https://x402.primer.systems`). Agent wallets require **zero ETH** for execution gas.
- ✅ **12 Live Machine-Callable Endpoints**: Production APIs covering scholarly literature, crypto pricing, FX rates, weather, geocoding, Wikidata, Hacker News, multi-source research, and claim verification.
- ✅ **Model Context Protocol (MCP)**: Native stdio MCP server for immediate integration into Claude Desktop, Cursor, and custom agent harnesses.
- ✅ **Repository-Local TypeScript SDK**: Includes bounded daily budgets, per-call price policies, and durable reservation locks to prevent overspending loops.
- ✅ **Dual-Asset Economics & $RELAY Token (Vibestarter)**: Day-1 token utilities including a 50% fuel discount, agent quota staking, provider quality bonding, and programmatic buyback & burn.
- ✅ **Zero Trackers & Zero Cookies**: Pure client-side cryptographic key storage with absolute privacy.

---

## Why Relay? Problem & Differentiation

### The Problem: Why Traditional API Subscriptions Fail Autonomous Agents
The software industry is transitioning from human prompt engineers to autonomous AI agent swarms (Devin, AutoGPT, Claude Code, Cursor). However, traditional monetization models create severe structural failures:
1. **Subagent Delegation & Runaway Loop Exposure:** When an autonomous agent spawns 20 parallel subagents to complete a task, it cannot safely pass master API keys or credit cards. A recursive hallucination or runaway query loop with a credit-card-backed API key can rack up thousands of dollars in unbounded liability.
2. **The Long-Tail Subscription Impossibility:** Real-world agents require heterogeneous, infrequent capabilities: one academic paper lookup, one weather forecast, one foreign exchange rate, one geocode lookup. Subscribing to 10 separate SaaS platforms costs **$200–$500/month in fixed fees** for what amounts to **$0.30 of actual data usage**.
3. **Machine-to-Machine Autonomous Commerce:** Autonomous software cannot pass KYC, enter CVV numbers, or open Stripe accounts. They need native, peer-to-peer programmable financial rails.

### How Relay Wins: Architectural Differentiation
Unlike generic x402 developer libraries or commodity API wrappers, Relay is designed as production-grade agentic infrastructure:
- 🤖 **Native Model Context Protocol (MCP) Server:** Relay is the first x402 gateway to provide an official stdio MCP server (`src/mcp/server.ts`). Claude Desktop, Cursor, Windsurf, or CLI workflows (`npm run demo:mcp`) discover and execute all 12 tools natively with zero custom blockchain code.
- 🛡️ **Atomic, Fail-Closed Budget Safety (`FileBudgetStore`):** The client runtime features an atomic local budget engine that physically halts and fails closed before signing if per-call ceilings (`MAX_PAYMENT_USDC`) or daily allowances (`MAX_DAILY_BUDGET_USDC`) are exceeded.
- ⚡ **Zero-Gas Settlement on Base:** Leverages EIP-712 `TransferWithAuthorization` under ERC-3009. Primer Systems public facilitator submits transactions and sponsors execution gas. Agents hold only native USDC.
- 🌐 **Open Capability Provider Marketplace:** The 12 initial endpoints serve as the verified reference catalog. Relay is architected as an open capability network where third-party developers stake $RELAY to register custom APIs and earn streaming USDC per call.
- 💎 **Vibestarter $RELAY Token Utility:** 50% discount when paying in $RELAY, permanent query allowances via agent quota staking, provider quality bonding, and a deflationary 20% protocol buyback & burn from all gateway USDC settlement fees on Base DEXs.

---

Relay implements the canonical two-phase x402 v2 handshake:

```
1. Client POST /v1/{resource} (Unsigned probe)
   │
   └──▶ Gateway returns HTTP 402 + PAYMENT-REQUIRED Header (base64 JSON challenge)

2. Client validates challenge (pins scheme, network, USDC contract, merchant, amount)
   │
   └──▶ Client generates random nonce & signs EIP-712 TransferWithAuthorization locally

3. Client POST /v1/{resource} + PAYMENT-SIGNATURE Header (base64 JSON proof)
   │
   └──▶ Gateway verifies authorization & retrieves upstream provider data
   │
   └──▶ Gateway submits proof to Primer Systems Facilitator on Base
   │
   └──▶ Facilitator broadcasts on-chain settlement & sponsors execution gas

4. Gateway returns HTTP 200 OK + PAYMENT-RESPONSE Header + Body Settlement Receipt
```

---

## Quick Start

Get the local development gateway and interactive Playground running in under 2 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/Dominion116/Relay.git
cd Relay

# 2. Install dependencies
npm install

# 3. Start development server & gateway
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to explore the visual x402 Playground, inspect protocol wire headers, and test gasless payments on Base Sepolia or Base Mainnet.

---

## Installation & Prerequisites

### Prerequisites

- **Node.js**: `24.x` (or `20.x` LTS minimum)
- **npm**: `9.x` or higher
- **Base RPC**: Public Base endpoint (configured by default)

### Setup Environment

Copy the example configuration to your local `.env`:

```bash
cp .env.example .env
```

### Environment Configuration Reference

| Variable | Used By | Required | Default | Purpose |
|---|---|---|---|---|
| `RELAY_NETWORK` | Gateway | No | `base` | Network target: `base` (Mainnet) or `base-sepolia` (Testnet) |
| `RELAY_TREASURY_ADDRESS` | Gateway / SDK | Yes | `0x420f9F...8072` | Pinned protocol merchant receiving USDC settlements |
| `FACILITATOR_URL` | Gateway | No | `https://x402.primer.systems` | Public x402 gasless facilitator endpoint |
| `RELAY_FACILITATOR_KEY` | Gateway | No | - | Optional server key for self-hosted settlement mode |
| `BASE_RPC_URL` | Gateway | No | Public RPC | RPC endpoint for the configured chain |
| `GATEWAY_ORIGIN` | Gateway / SDK | Yes | `http://localhost:5173` | Canonical public gateway origin |
| `AGENT_PRIVATE_KEY` | Local SDK / MCP | Yes | - | Agent payer wallet private key (**never sent over wire**) |
| `MAX_PAYMENT_USDC` | Local SDK / MCP | Yes | `0.20` | Hard spending ceiling per individual call |
| `MAX_DAILY_BUDGET_USDC` | Local SDK / MCP | Yes | `5.00` | Hard daily cumulative spending ceiling (UTC day) |
| `RELAY_BUDGET_FILE` | MCP Server | No | `~/.relay/mcp-budget.json` | Persistent budget file location |

> [!WARNING]
> Never expose `AGENT_PRIVATE_KEY` in `VITE_` variables. `VITE_` variables are bundled directly into public client browser assets.

---

## Usage

### 1. TypeScript SDK (`RelayClient`)

The repository includes a battle-tested, bounded client SDK at `src/sdk/index.ts` with local budget tracking and concurrency protection:

```typescript
import { RelayClient } from './src/sdk/index.ts';

const relay = new RelayClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  gatewayUrl: 'https://relayx402.vercel.app',
  network: 'base', // or 'base-sepolia'
  treasuryAddress: '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
  maxPaymentUsdc: '0.10',       // Strict per-call limit
  maxDailyBudgetUsdc: '2.00',   // Strict 24h UTC limit
});

// 1. Fetch real-time crypto prices ($0.04 USDC)
const prices = await relay.crypto.price(['bitcoin', 'ethereum'], 'usd');
console.log('Prices:', prices.data);
console.log('On-chain receipt:', prices.settlement);

// 2. Search scholarly papers via OpenAlex ($0.08 USDC)
const papers = await relay.academic.search('zero-knowledge proofs', 5);
console.log('Scholarly works:', papers.data);
```

### 2. Standalone One-Liner Execution

Run an autonomous query directly from your terminal using Node and the repo's loader:

```bash
node --env-file-if-exists=.env --import tsx --input-type=module -e "
import { RelayClient } from './src/sdk/index.ts';
const relay = new RelayClient({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  gatewayUrl: 'https://relayx402.vercel.app',
  network: 'base',
  treasuryAddress: '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
  maxPaymentUsdc: '0.10',
  maxDailyBudgetUsdc: '1.00'
});
console.log(await relay.crypto.price(['bitcoin'], 'usd'));
"
```

### 3. Model Context Protocol (MCP) Integration

Relay exposes all 12 capabilities as native MCP tools over standard I/O for Claude Desktop, Cursor, and custom agent harnesses.

#### Terminal Launch
```bash
npm run mcp
```

#### Claude Desktop & Cursor Configuration
Add Relay to your MCP settings file (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "relay": {
      "command": "node",
      "args": [
        "--env-file-if-exists=.env",
        "--import",
        "tsx",
        "/ABSOLUTE/PATH/TO/Relay/src/mcp/server.ts"
      ],
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_AGENT_PRIVATE_KEY",
        "BASE_NETWORK": "base",
        "GATEWAY_ORIGIN": "https://relayx402.vercel.app",
        "RELAY_TREASURY_ADDRESS": "0x420f9F9deA7fA318eA8996C8aA00ad9738D98072",
        "MAX_PAYMENT_USDC": "0.20",
        "MAX_DAILY_BUDGET_USDC": "5.00"
      }
    }
  }
}
```

---

## Live Endpoints & Pricing Reference

Machine discovery is permanently published at `/.well-known/x402`. All endpoints use `POST` with JSON payloads:

| Endpoint | Input Parameters | Scope & Upstream Source | Cost (USDC) |
|---|---|---|---|
| `/v1/academic/search` | `query` (str), `limit` (int, 1-20) | OpenAlex / Crossref scholarly records with DOIs | **$0.08** |
| `/v1/academic/work` | `doi` (str) | Detailed work metadata, citation counts, open access | **$0.06** |
| `/v1/crypto/price` | `assets` (arr), `vsCurrency` (str) | CoinGecko spot prices & 24h percentage changes | **$0.04** |
| `/v1/crypto/market` | `assets` (arr) | CoinGecko USD market cap, volume, and rank | **$0.06** |
| `/v1/fx/rates` | `baseCurrency` (opt), `targets` (arr) | European Central Bank reference exchange rates | **$0.04** |
| `/v1/weather` | `latitude` (num), `longitude` (num) | Open-Meteo current observations & 3-day forecast | **$0.05** |
| `/v1/geocode` | `query` (str) | Forward geocoding coordinates via OpenStreetMap / Photon | **$0.04** |
| `/v1/holidays` | `countryCode` (str), `year` (int) | Nager.Date official national & regional holiday schedule | **$0.04** |
| `/v1/knowledge/search`| `query` (str) | Wikidata entity identifiers, descriptions, and labels | **$0.06** |
| `/v1/news/search` | `query` (str) | Recent Hacker News submissions via Algolia (last 30 days) | **$0.08** |
| `/v1/research` | `topic` (str) | Multi-source research pack (academic + Wikidata + news) | **$0.10** |
| `/v1/verify` | `claim` (str) | Evidence retrieval pack for autonomous claim verification | **$0.12** |

> **Payload Constraints**: Request bodies are capped at 16 KiB. Parameter arrays accept at most 10 items. Malformed, unknown, or null fields fail closed with HTTP 400 before payment.

---

## Network & Contract Specifications

| Parameter | Base Mainnet (`eip155:8453`) | Base Sepolia (`eip155:84532`) |
|---|---|---|
| **Chain ID** | `8453` | `84532` |
| **USDC Contract** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **EIP-712 Domain Name** | `"USD Coin"` | `"USDC"` |
| **EIP-712 Domain Version** | `"2"` | `"2"` |
| **Facilitator Target** | `https://x402.primer.systems` | `https://x402.primer.systems` |
| **Settlement Standard** | ERC-3009 (`TransferWithAuthorization`) | ERC-3009 (`TransferWithAuthorization`) |

---

## Network Economics & $RELAY Token (Vibestarter)

The upcoming **$RELAY** token powers four core Day-1 protocol utilities on Base:

### 1. The Four Day-1 Token Jobs

1. **In-Protocol Fuel & 50% Query Discount**: Canonical x402 challenges accept multi-asset settlement. Agents settling in $RELAY receive an automatic **50% discount** compared to USDC, driving constant spot buy demand from high-frequency agent operators.
2. **Tiered Agent Quota Staking**: Swarm operators stake $RELAY non-custodially to unlock daily gasless query credits that refresh every 24h UTC, eliminating per-call signature overhead while retaining principal.
3. **Provider Marketplace Bonding & Slashing**: Third-party API operators bond 5,000 $RELAY as quality collateral. Slashed funds (>2% downtime or latency >1.5s) are distributed 50% as USDC compensation to callers and 50% burned.
4. **Programmatic Buyback & Burn**: 20% of all gateway USDC fees are automatically routed into weekly DEX buybacks on Base and permanently burned to `0x...dead`.

### 2. Quota Staking Tiers

| Tier Level | Target Audience | Staked $RELAY | Daily Free Calls | Rate Limit | Routing Queue |
|---|---|---|---|---|---|
| **Tier 0 (PAYG)** | Explorers & one-off scripts | `0 $RELAY` | 0 (per-call x402) | 30 req/min | Standard |
| **Tier 1 (Micro)** | Single bots, Cursor MCP | `2,500 $RELAY` | 100 calls/day | 60 req/min | Standard |
| **Tier 2 (Swarm)** | Multi-agent swarms, Eliza | `25,000 $RELAY` | 1,500 calls/day | 180 req/min | Priority Lane |
| **Tier 3 (Enterprise)**| Production agent orgs, DAOs | `100,000 $RELAY` | 10,000 calls/day | 600 req/min | Dedicated Routing |

### 3. Protocol Revenue Split & Token Allocations

- **70%**: Upstream API Data Providers & Node Infra (settled in USDC).
- **10%**: Protocol Treasury (audits, engineering, Base sequencer subsidies).
- **20%**: Programmatic Buyback & Burn on Base DEXs.

**Token Supply:** Strictly capped at **100,000,000 $RELAY** (non-inflationary).
- **40%**: Public Vibestarter Raise & Base DEX Liquidity Pool (LP paired & locked).
- **25%**: Agent Quota Staking Pool & Ecosystem Grants (36-month linear release).
- **15%**: Core Engineering & Security Audits (12-month cliff, 24-month linear vest).
- **10%**: Provider Bonding Incentives & Slashing Insurance Reserve.
- **10%**: Protocol Treasury Reserve & Sequencer Gas Pool.

> *Note: Token launch and liquidity bootstrapping will occur via the Vibestarter platform post-hackathon in accordance with Vibeathon 02 rules.*

---

## Troubleshooting & Error Recovery

| Status | Cause | Resolution |
|---|---|---|
| `HTTP 400` | Malformed JSON or oversized request (>16 KiB) | Correct request body schema before signing. |
| `HTTP 402` | Challenge issued; missing or invalid payment | Sign the returned challenge with matching network and amount. |
| `HTTP 405` | Invalid HTTP method | Capability execution strictly requires `POST`. |
| `HTTP 502` | Upstream provider timeout or error | Provider failed prior to settlement. Do not retry uncertain payments. |
| `HTTP 503` | Facilitator unreachable or settlement pending | Preserve transaction hash. Reconcile on Base before retrying. |

### Reconciliation Rule
A timeout or malformed response after exposing an EIP-712 signature is an **uncertain outcome**, not proof of zero spend. The SDK automatically retains budget reservations. **Never submit duplicate payments automatically without reconciling on-chain.**

---

## Testing & Development

Run the complete test suite and verification commands:

```bash
# Run 181 unit & integration tests
npm test

# Run strict TypeScript typechecking
npm run typecheck

# Build production bundle and Vercel serverless API
npm run build

# Preview production build locally
npm run preview

# Run standalone API server tests
npm run test:api
```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository (`https://github.com/Dominion116/Relay.git`)
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and typechecks (`npm test && npm run typecheck`)
4. Commit your changes (`git commit -m 'feat: add amazing capability'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Base](https://base.org) - Sub-cent L2 settlement layer
- [Primer Systems](https://primer.systems) - Public x402 settlement facilitator
- [Circle](https://circle.com/usdc) - Official native USD Coin & ERC-3009 standard
- [OpenAlex](https://openalex.org) - Open scholarly literature index
- [CoinGecko](https://coingecko.com) - Digital asset pricing and market data
- [Open-Meteo](https://open-meteo.com) - Global weather forecasting API
- [Frankfurter](https://frankfurter.dev) - European Central Bank currency reference rates
