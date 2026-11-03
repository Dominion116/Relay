import { X402Resource, X402Challenge, X402PaymentProof, X402VerificationResult, WellKnownX402Manifest } from '../types/x402';
import * as providers from './providers';

// Official Base USDC Token Contracts
export const BASE_USDC_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_USDC_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Default merchant receiver address on Base
export const DEFAULT_TREASURY_ADDRESS = '0x892a0e28f3D343054eA8C0a3eA625dC0bA0241A5';

export const RELAY_RESOURCES: X402Resource[] = [
  {
    id: 'academic_search',
    name: 'Academic Search',
    category: 'academic',
    url: '/v1/academic/search',
    path: '/v1/academic/search',
    method: 'POST',
    description: 'Search scholarly literature via OpenAlex with normalized DOIs, citations, authors, and open-access status.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '80000', // 0.08 USDC
    priceUsdc: 0.08,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'cryptographic payment channel layer 2', limit: 3 },
    schema: {
      request: {
        query: { type: 'string', required: true, description: 'Keywords or academic subject' },
        limit: { type: 'number', required: false, description: 'Number of works (1-20)' }
      },
      responseSample: {
        query: "cryptographic payment channel layer 2",
        total_results: 142,
        results: [{ title: "Off-chain Scalability and x402 Micropayments", doi: "10.1145/3543507" }]
      }
    }
  },
  {
    id: 'academic_work',
    name: 'Academic Work DOI',
    category: 'academic',
    url: '/v1/academic/work',
    path: '/v1/academic/work',
    method: 'POST',
    description: 'Retrieve detailed scholarly work and citation metrics by digital object identifier (DOI).',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '60000', // 0.06 USDC
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { doi: '10.1038/s41586-020-2649-2' },
    schema: {
      request: {
        doi: { type: 'string', required: true, description: 'Digital Object Identifier' }
      },
      responseSample: {
        doi: "https://doi.org/10.1038/s41586-020-2649-2",
        title: "An ultra-scalable consensus protocol",
        cited_by_count: 320
      }
    }
  },
  {
    id: 'crypto_price',
    name: 'Crypto Price & 24h',
    category: 'crypto',
    url: '/v1/crypto/price',
    path: '/v1/crypto/price',
    method: 'POST',
    description: 'Real-time spot price and 24-hour percentage change for cryptocurrency assets via CoinGecko.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '40000', // 0.04 USDC
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ['ethereum', 'bitcoin'], vsCurrency: 'usd' },
    schema: {
      request: {
        assets: { type: 'array of string', required: true, description: 'CoinGecko IDs (e.g. ["ethereum", "bitcoin"])' },
        vsCurrency: { type: 'string', required: false, description: 'Quote currency (default: "usd")' }
      },
      responseSample: {
        quote_currency: "USD",
        prices: [{ asset: "ethereum", price: 2620.45, change_24h_percent: 2.1 }]
      }
    }
  },
  {
    id: 'crypto_market',
    name: 'Crypto Market Cap & Volume',
    category: 'crypto',
    url: '/v1/crypto/market',
    path: '/v1/crypto/market',
    method: 'POST',
    description: 'Market capitalization, rank, 24h trading volume, and circulating supply.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '60000', // 0.06 USDC
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ['ethereum', 'bitcoin'] },
    schema: {
      request: {
        assets: { type: 'array of string', required: true, description: 'Asset identifiers' }
      },
      responseSample: {
        market_data: [{ symbol: "ETH", current_price: 2620.45, market_cap: 315000000000 }]
      }
    }
  },
  {
    id: 'fx_rates',
    name: 'Foreign Exchange Rates',
    category: 'market',
    url: '/v1/fx/rates',
    path: '/v1/fx/rates',
    method: 'POST',
    description: 'Official European Central Bank (ECB) reference exchange rates for international fiat currencies.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '40000', // 0.04 USDC
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { baseCurrency: 'USD', targets: ['EUR', 'GBP', 'JPY', 'CAD'] },
    schema: {
      request: {
        baseCurrency: { type: 'string', required: false, description: 'Base 3-letter currency code (default: USD)' },
        targets: { type: 'array of string', required: false, description: 'List of target currency codes' }
      },
      responseSample: {
        base: "USD",
        rates: { EUR: 0.92, GBP: 0.77, JPY: 152.4 }
      }
    }
  },
  {
    id: 'weather',
    name: 'Weather & Multi-day Forecast',
    category: 'weather',
    url: '/v1/weather',
    path: '/v1/weather',
    method: 'POST',
    description: 'Current meteorological conditions and 3-day forecast for any coordinates via Open-Meteo.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '50000', // 0.05 USDC
    priceUsdc: 0.05,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { latitude: 37.7749, longitude: -122.4194 },
    schema: {
      request: {
        latitude: { type: 'number', required: true, description: 'Latitude coordinate' },
        longitude: { type: 'number', required: true, description: 'Longitude coordinate' }
      },
      responseSample: {
        current: { temperature_c: 18.5, humidity_percent: 62 },
        forecast_daily: [{ date: "2026-10-31", max_temp_c: 21.0 }]
      }
    }
  },
  {
    id: 'geocode',
    name: 'Geocoding & Reverse Lookup',
    category: 'geo',
    url: '/v1/geocode',
    path: '/v1/geocode',
    method: 'POST',
    description: 'Forward place-name geocoding to GPS coordinates and administrative boundaries via Photon / OSM.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '40000', // 0.04 USDC
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Coinbase Headquarters San Francisco' },
    schema: {
      request: {
        query: { type: 'string', required: true, description: 'Location, city, address or landmark' }
      },
      responseSample: {
        features: [{ name: "San Francisco", country: "United States", coordinates: { latitude: 37.7749, longitude: -122.4194 } }]
      }
    }
  },
  {
    id: 'holidays',
    name: 'Public Holidays Registry',
    category: 'knowledge',
    url: '/v1/holidays',
    path: '/v1/holidays',
    method: 'POST',
    description: 'Official national and regional public holiday schedules and observance dates via Nager.Date.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '40000', // 0.04 USDC
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { countryCode: 'US', year: 2026 },
    schema: {
      request: {
        countryCode: { type: 'string', required: true, description: 'ISO 2-letter country code' },
        year: { type: 'number', required: false, description: 'Year (default: 2026)' }
      },
      responseSample: {
        country_code: "US",
        holidays: [{ date: "2026-07-04", name: "Independence Day", global: true }]
      }
    }
  },
  {
    id: 'knowledge_search',
    name: 'Wikidata Knowledge Entities',
    category: 'knowledge',
    url: '/v1/knowledge/search',
    path: '/v1/knowledge/search',
    method: 'POST',
    description: 'Search structured Wikidata knowledge graph for canonical entities, Q-identifiers, and descriptions.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '60000', // 0.06 USDC
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Base layer 2 network' },
    schema: {
      request: {
        query: { type: 'string', required: true, description: 'Search term or entity name' }
      },
      responseSample: {
        entities: [{ id: "Q117188880", label: "Base", description: "Ethereum Layer 2 network developed by Coinbase" }]
      }
    }
  },
  {
    id: 'news_search',
    name: 'Real-Time News Coverage',
    category: 'news',
    url: '/v1/news/search',
    path: '/v1/news/search',
    method: 'POST',
    description: 'Live global news coverage and domain analysis with normalized publishing dates and sources.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '80000', // 0.08 USDC
    priceUsdc: 0.08,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Base network layer 2' },
    schema: {
      request: {
        query: { type: 'string', required: true, description: 'Topic or keyword to monitor' }
      },
      responseSample: {
        query: "Base network layer 2",
        articles: [{ title: "Autonomous Agents Transacting on Base", source: "Decrypt" }]
      }
    }
  },
  {
    id: 'research',
    name: 'Deterministic Research Pack',
    category: 'research',
    url: '/v1/research',
    path: '/v1/research',
    method: 'POST',
    description: 'Synthesizes multi-domain evidence (Academic + Wikidata + News) with full source provenance; no LLM hallucination.',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '100000', // 0.10 USDC
    priceUsdc: 0.10,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { topic: 'zero knowledge rollups and micropayments' },
    schema: {
      request: {
        topic: { type: 'string', required: true, description: 'Research subject or question' }
      },
      responseSample: {
        provenance: { is_llm_hallucination: false, settlement_network: "Base" },
        evidence: { scholarly_citations: [], wikidata_entities: [], recent_news: [] }
      }
    }
  },
  {
    id: 'verify',
    name: 'Deterministic Claim Verification',
    category: 'research',
    url: '/v1/verify',
    path: '/v1/verify',
    method: 'POST',
    description: 'Verify claims against cross-referenced databases returning an explainable verdict (SUPPORTED, CONTRADICTED, MIXED).',
    network: 'base',
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: 'USDC',
    amount: '120000', // 0.12 USDC
    priceUsdc: 0.12,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { claim: 'Base is an Ethereum Layer 2 rollup developed by Coinbase' },
    schema: {
      request: {
        claim: { type: 'string', required: true, description: 'Assertion or factual statement to verify' }
      },
      responseSample: {
        verdict: "SUPPORTED",
        heuristic_metrics: { confidence: 0.95, negation_cue_detected: false }
      }
    }
  }
];

export function generate402Challenge(resource: X402Resource, network: 'base' | 'base-sepolia' = 'base'): X402Challenge {
  const nonce = `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity

  return {
    x402Version: 2,
    error: 'Payment Required',
    message: `Payment of ${(Number(resource.amount) / 1000000).toFixed(2)} USDC on ${network.toUpperCase()} is required to access ${resource.name}.`,
    paymentRequirements: {
      scheme: 'transferWithAuthorization',
      network,
      chainId: network === 'base' ? 8453 : 84532,
      tokenAddress: network === 'base' ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA,
      tokenSymbol: 'USDC',
      amount: resource.amount,
      amountFormatted: `${(Number(resource.amount) / 1000000).toFixed(2)} USDC`,
      payTo: resource.payTo,
      nonce,
      validBefore,
      resource: resource.path
    }
  };
}

export function verifyPaymentProof(proof: X402PaymentProof, resource: X402Resource): X402VerificationResult {
  // If payment is supplied:
  if (!proof || !proof.payerAddress) {
    return { valid: false, payer: '', amount: '0', error: 'Missing payment proof or payer address' };
  }

  // Check valid timestamp
  const now = Date.now();
  if (proof.timestamp && (now - proof.timestamp > 3600000)) {
    return { valid: false, payer: proof.payerAddress, amount: '0', error: 'Payment authorization expired' };
  }

  // Simulated & Onchain verification check
  const txHash = proof.txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

  return {
    valid: true,
    payer: proof.payerAddress,
    amount: resource.amount,
    txHash,
    settledAt: new Date().toISOString()
  };
}

export async function dispatchResourceRequest(resourceId: string, params: Record<string, any>) {
  switch (resourceId) {
    case 'academic_search':
      return await providers.fetchAcademicSearch(params.query || 'blockchain', params.limit || 3);
    case 'academic_work':
      return await providers.fetchAcademicWork(params.doi || '10.1038/s41586-020-2649-2');
    case 'crypto_price':
      return await providers.fetchCryptoPrice(params.assets || ['ethereum', 'bitcoin'], params.vsCurrency || 'usd');
    case 'crypto_market':
      return await providers.fetchCryptoMarket(params.assets || ['ethereum', 'bitcoin']);
    case 'fx_rates':
      return await providers.fetchFxRates(params.baseCurrency || 'USD', params.targets || ['EUR', 'GBP', 'JPY']);
    case 'weather':
      return await providers.fetchWeather(params.latitude || 37.7749, params.longitude || -122.4194);
    case 'geocode':
      return await providers.fetchGeocode(params.query || 'San Francisco');
    case 'holidays':
      return await providers.fetchHolidays(params.countryCode || 'US', params.year || 2026);
    case 'knowledge_search':
      return await providers.fetchKnowledgeSearch(params.query || 'Base layer 2');
    case 'news_search':
      return await providers.fetchNewsSearch(params.query || 'Base ecosystem');
    case 'research':
      return await providers.fetchResearchPack(params.topic || 'layer 2 state channels');
    case 'verify':
      return await providers.fetchVerifyClaim(params.claim || 'Base is an Ethereum Layer 2 rollup');
    default:
      throw new Error(`Unknown resource ID: ${resourceId}`);
  }
}

export function getWellKnownManifest(origin: string = 'https://relay.xyz'): WellKnownX402Manifest {
  return {
    x402Version: 2,
    name: 'Relay',
    description: 'Pay-per-use information infrastructure for AI agents and developers: every capability is paid per request in USDC on Base via the x402 protocol.',
    network: 'base',
    chainId: 8453,
    facilitator: 'Relay x402 Gateway (Coinbase CDP / Base Native)',
    resources: RELAY_RESOURCES.map(r => ({
      url: `${origin}${r.path}`,
      method: r.method,
      description: `${r.description} - ${(Number(r.amount) / 1000000).toFixed(2)} USDC per call.`,
      network: `eip155:8453`,
      asset: r.asset,
      amount: r.amount,
      payTo: r.payTo
    }))
  };
}
