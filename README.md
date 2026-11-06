# Relay

Pay-per-request data for AI agents and developers, using canonical x402 v2 and USDC on Base. Powered by the Primer Systems public x402 facilitator for gasless settlement.

**Deployment status:** Relay is configured for Base Mainnet (`base`) by default and supports Base Sepolia (`base-sepolia`) for testing. Production payments settle gaslessly via the Primer Systems public x402 facilitator.

## Local Setup

Use Node 24.x and npm. From the repository root:

```sh
npm install
npm run dev
```

The application and development gateway are available at `http://localhost:5173`. The Playground calls the HTTP gateway, not provider or payment-engine functions imported into the browser. Discovery at `/.well-known/x402` is free.

The gateway can be configured for Base Mainnet (default) or Base Sepolia. Begin with explicit client budgets. Never place wallet or private keys in a `VITE_` variable; every `VITE_` value is public browser configuration.

| Setting | Used By | Purpose |
|---|---|---|
| `RELAY_NETWORK` | Gateway | `base` or `base-sepolia`; defaults to mainnet |
| `RELAY_TREASURY_ADDRESS` | Gateway and SDK/MCP | Trusted merchant address; match the browser setting |
| `FACILITATOR_URL` | Gateway only | Public x402 facilitator endpoint (defaults to Primer Systems `https://x402.primer.systems`) |
| `RELAY_FACILITATOR_KEY` | Gateway only | Optional local server signer that submits USDC authorizations and pays gas (self-hosted mode) |
| `BASE_RPC_URL` | Gateway only | RPC for the configured chain |
| `GATEWAY_ORIGIN` | Gateway and SDK/MCP | Exact public gateway origin; use `http://localhost:5173` locally |
| `VITE_BASE_NETWORK` | Browser | Must match `RELAY_NETWORK` |
| `VITE_RELAY_TREASURY_ADDRESS` | Browser | Pinned merchant address; must match the gateway |
| `VITE_GATEWAY_URL` | Browser | HTTPS gateway origin, or HTTP loopback; defaults to the page origin |
| `VITE_BASE_RPC_URL` | Browser | Optional public RPC for balance reads on the configured chain |
| `VITE_WALLETCONNECT_PROJECT_ID` | Browser | Optional WalletConnect project ID; without it, injected wallets remain available |
| `AGENT_PRIVATE_KEY` | Local SDK/MCP only | Payer wallet key; never sent to the gateway |
| `BASE_NETWORK` | Local SDK/MCP | `base` or `base-sepolia`, matching the gateway |
| `MAX_PAYMENT_USDC` | Local SDK/MCP | Explicit maximum per call; missing or zero disables payments |
| `MAX_DAILY_BUDGET_USDC` | Local SDK/MCP | Explicit daily ceiling; missing or zero disables payments |
| `RELAY_BUDGET_FILE` | MCP | Optional absolute ledger path outside the checkout; defaults to `~/.relay/mcp-budget.json` |

An example configuration for Base Mainnet is:

```text
RELAY_NETWORK=base
RELAY_TREASURY_ADDRESS=0x420f9F9deA7fA318eA8996C8aA00ad9738D98072
FACILITATOR_URL=https://x402.primer.systems
GATEWAY_ORIGIN=https://relayx402.vercel.app
VITE_BASE_NETWORK=base
VITE_RELAY_TREASURY_ADDRESS=0x420f9F9deA7fA318eA8996C8aA00ad9738D98072
VITE_GATEWAY_URL=https://relayx402.vercel.app
BASE_NETWORK=base
MAX_PAYMENT_USDC=0
MAX_DAILY_BUDGET_USDC=0
```

Set the matching treasury addresses and secret keys only in the relevant local/server environment. A wrong network, merchant, token, resource, or amount is rejected before signing. Relay uses the Primer Systems public x402 facilitator (`https://x402.primer.systems`) by default on Base Mainnet and Base Sepolia, requiring zero server gas funding. Alternatively, a self-hosted facilitator can be configured with `RELAY_FACILITATOR_KEY`.

## Endpoints And Prices

Prices are per request in USDC; one USDC equals 1,000,000 atomic units. All twelve capability endpoints use POST and accept JSON objects. `/api/v1/...` aliases are also supported.

| Endpoint | Parameters | Provider / Scope | USDC |
|---|---|---|---|
| `/v1/academic/search` | `query`, optional `limit` | OpenAlex / Crossref scholarly records | 0.08 |
| `/v1/academic/work` | `doi` | DOI lookup | 0.06 |
| `/v1/crypto/price` | `assets`, optional `vsCurrency` | CoinGecko IDs, requested quote currency | 0.04 |
| `/v1/crypto/market` | `assets` | CoinGecko USD market metrics | 0.06 |
| `/v1/fx/rates` | optional `baseCurrency`, `targets` | ECB reference rates via Frankfurter | 0.04 |
| `/v1/weather` | `latitude`, `longitude` | Open-Meteo current weather and forecast | 0.05 |
| `/v1/geocode` | `query` | Forward geocoding, not reverse lookup | 0.04 |
| `/v1/holidays` | `countryCode`, optional `year` | Nager.Date public holidays | 0.04 |
| `/v1/knowledge/search` | `query` | Wikidata entities | 0.06 |
| `/v1/news/search` | `query` | Recent Hacker News submissions, not global newsroom coverage | 0.08 |
| `/v1/research` | `topic` | Aggregated retrieved source material | 0.10 |
| `/v1/verify` | `claim` | Claim evidence retrieval; not an automated factual verdict | 0.12 |

Requests are capped at 16 KiB. Arrays contain at most ten values. Coordinates must be finite and within geographic bounds; zero is valid. Unknown fields and missing required inputs are rejected rather than silently substituted. Academic search limits are 1-20; holiday years are 1900-2100. Asset identifiers are CoinGecko IDs such as `bitcoin`, not exchange symbols.

Provider limitations are explicit: missing DOIs and unknown open-access status can be null; Hacker News `submitted_at` is not an article publication timestamp; claim lookup returns `INSUFFICIENT` with `confidence: null` and actual search evidence. Research does not certify the truth of retrieved content. Provider errors are not replaced with fabricated results.

## Canonical Payment Flow

1. POST a valid request without payment. HTTP 402 returns a base64 JSON `PAYMENT-REQUIRED` header and a matching challenge body.
2. Validate `x402Version: 2`, `resource`, and `accepts`. Pin the `exact` scheme, configured `eip155` network, official USDC asset, merchant, exact catalog amount, and bounded lifetime.
3. Create a cryptographically random nonce and sign EIP-712 `TransferWithAuthorization`. Submit the complete proof once in the base64 JSON `PAYMENT-SIGNATURE` header.
4. The gateway verifies authorization, retrieves a successful provider result, then submits and confirms settlement. Only then does HTTP 200 return `PAYMENT-RESPONSE` and `{ "_settlement": ..., "data": ... }`.

The canonical proof contains:

```text
{
  x402Version: 2,
  resource: { url, description, mimeType },
  accepted: { scheme: "exact", network, asset, amount, payTo, maxTimeoutSeconds, extra },
  payload: {
    signature,
    authorization: { from, to, value, validAfter, validBefore, nonce }
  }
}
```

Authorization timestamps are decimal strings. The maximum lifetime is 300 seconds. A signature alone, a transaction hash alone, or legacy Authorization headers are not valid proofs.

The successful `PAYMENT-RESPONSE` contains `success: true`, `transaction`, `network`, `payer`, and `amount`. The matching body receipt contains `protocol: "x402 v2"`, `network`, `asset: "USDC"`, `cost_usdc`, `payer`, `tx_hash`, and `settled_at`. The client requires both the canonical header and matching body; a signature is not itself evidence of settlement.

| Network | Chain ID | Official USDC | EIP-712 Domain |
|---|---|---|---|
| Base Mainnet | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `USD Coin`, version `2` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `USDC`, version `2` |

Sepolia tokens are test tokens, not mainnet USDC. No ETH is required in the payer wallet or on the server for an off-chain authorization; the Primer Systems public facilitator submits the transaction and covers execution gas.

## Repository-Local SDK

The SDK is source code in this checkout, not a published Relay npm package. Import it locally with the installed tsx loader. Explicit per-call and daily limits are required; the default is no automatic payment.

```ts
import { RelayClient } from './src/sdk/index.ts';

const relay = new RelayClient({
  privateKey: process.env.AGENT_PRIVATE_KEY || '',
  gatewayUrl: process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app',
  network: (process.env.BASE_NETWORK as 'base' | 'base-sepolia') || 'base',
  treasuryAddress: process.env.RELAY_TREASURY_ADDRESS || '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
  maxPaymentUsdc: process.env.MAX_PAYMENT_USDC || '0',
  maxDailyBudgetUsdc: process.env.MAX_DAILY_BUDGET_USDC || '0'
});

const { settlement, data } = await relay.crypto.price(['bitcoin'], 'eur');
console.log(settlement, data);
```

This complete command runs from the repository root with the same configured environment:

```sh
node --env-file-if-exists=.env --import tsx --input-type=module -e "import { RelayClient } from './src/sdk/index.ts'; const relay = new RelayClient({ privateKey: process.env.AGENT_PRIVATE_KEY || '', gatewayUrl: process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app', network: (process.env.BASE_NETWORK as any) || 'base', treasuryAddress: process.env.RELAY_TREASURY_ADDRESS || '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072', maxPaymentUsdc: process.env.MAX_PAYMENT_USDC || '0', maxDailyBudgetUsdc: process.env.MAX_DAILY_BUDGET_USDC || '0' }); console.log(await relay.crypto.price(['bitcoin'], 'eur'));"
```

For example, limits of `0.12` per call and `5` per UTC day permit calls within those ceilings. Set those values only when authorized to spend. The SDK pins exact catalog prices unless an explicit per-call price policy permits otherwise. Reservations prevent concurrent calls from exceeding a budget. Its default ledger is process-local; long-running applications can provide a budget store. MCP uses a persistent store by default.

The website's TypeScript documentation also contains a complete manually authorized Viem example using `src/shared/paymentClient.ts`. Automated clients should use the SDK budget policy instead of reproducing an unbounded signing loop.

## Local MCP Server

For a terminal launch from the checkout:

```sh
npm run mcp
```

For Claude Desktop or Cursor, use a direct Node stdio launcher so npm banners do not contaminate protocol output. Replace both absolute paths and the private-key/treasury placeholders. This configuration uses Base Mainnet by default (or set `BASE_NETWORK` to `base-sepolia` for testnet):

```json
{
  "mcpServers": {
    "relay": {
      "command": "node",
      "args": [
        "--import",
        "file:///C:/path/to/Relay/node_modules/tsx/dist/loader.mjs",
        "C:/path/to/Relay/src/mcp/server.ts"
      ],
      "env": {
        "AGENT_PRIVATE_KEY": "YOUR_LOCAL_WALLET_PRIVATE_KEY",
        "BASE_NETWORK": "base",
        "GATEWAY_ORIGIN": "https://relayx402.vercel.app",
        "RELAY_TREASURY_ADDRESS": "0x420f9F9deA7fA318eA8996C8aA00ad9738D98072",
        "MAX_PAYMENT_USDC": "0",
        "MAX_DAILY_BUDGET_USDC": "0"
      }
    }
  }
}
```

On macOS/Linux, use the corresponding absolute filesystem path and `file:///...` loader URL. The server exposes twelve tools over stdio and calls the gateway over HTTP; it does not run provider or settlement code inside the MCP client.

The persistent ledger is keyed by wallet address, network, and UTC day. `RELAY_BUDGET_FILE` can select an absolute location outside the checkout. Once a signature may have been submitted, its reservation is retained even if the request fails. Do not delete the ledger or its lock to bypass unresolved spending.

## Errors And Reconciliation

- `400`, `413`, `415`: invalid shape, excessive body size, or unsupported content type; correct the input before signing.
- `405`: use POST for capability execution.
- `402`: missing payment returns a challenge; malformed, expired, invalid, or consumed authorizations are rejected.
- `502`: provider retrieval failed before settlement submission. Clients still retain reservations for any authorization they have exposed.
- `503`: configuration/verification may be unavailable, or settlement may be pending. Preserve the error code and any returned transaction hash.

For `settlement_pending` or `settlement_in_progress`, `PAYMENT-RESPONSE` has `success: false`; the response does not contain paid data. A timeout or malformed response after submitting a signature is also an uncertain outcome. **Do not sign another payment automatically.** Reconcile the known transaction and authorization on the configured network with the gateway operator.

Playground history distinguishes pending authorizations from confirmed receipts and survives page navigation within the tab. It is not a durable accounting ledger; export records before reloading or closing the tab. Neither the UI nor gateway fabricates transaction hashes.

## Validation And Build

```sh
npm test
npm run typecheck
npm run build
npm run test:api
npm run preview
```

Run the desktop/mobile browser regressions against an isolated production-mode fixture and local preview server:

```sh
npx playwright install chromium
npm run test:browser
```

Automated regressions use mocked provider/RPC transports and test-only accounts. Browser checks build `.browser-dist` without reading `.env`, use fixed local gateway settings, isolated unconnected browser contexts, and unpaid HTTP requests. Wallet approval, external service availability, and real on-chain settlement require separate verification. A production build does not deploy the application or prove the currently hosted version uses the corrected protocol.

The gateway requires two L2 confirmations through its configured RPC, not L1 finality. Pending transaction metadata is process-local and denial-only; it is not a durable fulfillment ledger. When using the default Primer Systems public facilitator (`https://x402.primer.systems`), multi-instance nonce allocation and gas sponsorship are handled externally. For self-hosted deployments, use a dedicated serialized facilitator signer or shared nonce coordination.
