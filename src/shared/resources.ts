import { getAddress } from 'viem';
import type { X402Resource } from '../types/x402';

// Public catalog defaults only. Server configuration belongs in the gateway.
export const BASE_USDC_MAINNET = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
export const BASE_USDC_SEPOLIA = getAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
export const DEFAULT_TREASURY_ADDRESS = getAddress('0x420f9F9deA7fA318eA8996C8aA00ad9738D98072');
export const PAYMENT_TIMEOUT_SECONDS = 300;

export const EIP712_TRANSFER_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
} as const;

export const RELAY_RESOURCES: X402Resource[] = [
  {
    id: 'academic_search', name: 'Academic Search', category: 'academic',
    url: '/v1/academic/search', path: '/v1/academic/search', method: 'POST',
    description: 'Search scholarly literature via OpenAlex with normalized DOIs, citations, authors, and open-access status.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '80000', priceUsdc: 0.08, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'cryptographic payment channel layer 2', limit: 3 },
    schema: {
      request: {
        query: { type: 'string', required: true, description: 'Keywords or academic subject' },
        limit: { type: 'number', required: false, description: 'Number of works (1-20)' }
      },
      responseSample: { query: 'cryptographic payment channel layer 2', total_results: 142, results: [{ title: 'Example scholarly work', doi: null }] }
    }
  },
  {
    id: 'academic_work', name: 'Academic Work DOI', category: 'academic',
    url: '/v1/academic/work', path: '/v1/academic/work', method: 'POST',
    description: 'Retrieve detailed scholarly work and citation metrics by digital object identifier (DOI).',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '60000', priceUsdc: 0.06, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { doi: '10.1038/s41586-020-2649-2' },
    schema: {
      request: { doi: { type: 'string', required: true, description: 'Digital Object Identifier' } },
      responseSample: { doi: 'https://doi.org/10.1038/s41586-020-2649-2', title: 'Example scholarly work', cited_by_count: 320 }
    }
  },
  {
    id: 'crypto_price', name: 'Crypto Price & 24h', category: 'crypto',
    url: '/v1/crypto/price', path: '/v1/crypto/price', method: 'POST',
    description: 'Spot prices and 24-hour percentage changes via CoinGecko in the requested quote currency.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '40000', priceUsdc: 0.04, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ['ethereum', 'bitcoin'], vsCurrency: 'usd' },
    schema: {
      request: {
        assets: { type: 'array of string', required: true, description: 'CoinGecko IDs (e.g. ["ethereum", "bitcoin"])' },
        vsCurrency: { type: 'string', required: false, description: 'Quote currency (default: "usd")' }
      },
      responseSample: { quote_currency: 'USD', prices: [{ asset: 'ethereum', price: 2620.45, change_24h_percent: 2.1 }] }
    }
  },
  {
    id: 'crypto_market', name: 'Crypto Market Cap & Volume', category: 'crypto',
    url: '/v1/crypto/market', path: '/v1/crypto/market', method: 'POST',
    description: 'CoinGecko USD market capitalization, rank, 24h trading volume, circulating supply, and all-time high.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '60000', priceUsdc: 0.06, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ['ethereum', 'bitcoin'] },
    schema: {
      request: { assets: { type: 'array of string', required: true, description: 'CoinGecko asset identifiers' } },
      responseSample: { market_data: [{ symbol: 'ETH', current_price: 2620.45, market_cap: 315000000000 }] }
    }
  },
  {
    id: 'fx_rates', name: 'Foreign Exchange Rates', category: 'market',
    url: '/v1/fx/rates', path: '/v1/fx/rates', method: 'POST',
    description: 'European Central Bank reference exchange rates via Frankfurter for supported fiat currencies.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '40000', priceUsdc: 0.04, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { baseCurrency: 'USD', targets: ['EUR', 'GBP', 'JPY', 'CAD'] },
    schema: {
      request: {
        baseCurrency: { type: 'string', required: false, description: 'Base 3-letter currency code (default: USD)' },
        targets: { type: 'array of string', required: false, description: 'List of target currency codes' }
      },
      responseSample: { base: 'USD', rates: { EUR: 0.92, GBP: 0.77, JPY: 152.4 } }
    }
  },
  {
    id: 'weather', name: 'Weather & Multi-day Forecast', category: 'weather',
    url: '/v1/weather', path: '/v1/weather', method: 'POST',
    description: 'Current conditions and a 3-day forecast for supplied coordinates via Open-Meteo.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '50000', priceUsdc: 0.05, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { latitude: 37.7749, longitude: -122.4194 },
    schema: {
      request: {
        latitude: { type: 'number', required: true, description: 'Latitude coordinate' },
        longitude: { type: 'number', required: true, description: 'Longitude coordinate' }
      },
      responseSample: { current: { temperature_c: 18.5, humidity_percent: 62 }, forecast_daily: [{ max_temp_c: 21.0 }] }
    }
  },
  {
    id: 'geocode', name: 'Forward Geocoding', category: 'geo',
    url: '/v1/geocode', path: '/v1/geocode', method: 'POST',
    description: 'Forward place-name geocoding to coordinates and administrative boundaries via Photon / OSM.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '40000', priceUsdc: 0.04, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Coinbase Headquarters San Francisco' },
    schema: {
      request: { query: { type: 'string', required: true, description: 'Location, city, address or landmark' } },
      responseSample: { features: [{ name: 'San Francisco', country: 'United States', coordinates: { latitude: 37.7749, longitude: -122.4194 } }] }
    }
  },
  {
    id: 'holidays', name: 'Public Holidays Registry', category: 'knowledge',
    url: '/v1/holidays', path: '/v1/holidays', method: 'POST',
    description: 'National and regional public holiday schedules and observance dates via Nager.Date.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '40000', priceUsdc: 0.04, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { countryCode: 'US', year: new Date().getUTCFullYear() },
    schema: {
      request: {
        countryCode: { type: 'string', required: true, description: 'ISO 2-letter country code' },
        year: { type: 'number', required: false, description: 'Year (default: current UTC year)' }
      },
      responseSample: { country_code: 'US', holidays: [{ date: '2026-07-04', name: 'Independence Day', global: true }] }
    }
  },
  {
    id: 'knowledge_search', name: 'Wikidata Knowledge Entities', category: 'knowledge',
    url: '/v1/knowledge/search', path: '/v1/knowledge/search', method: 'POST',
    description: 'Search Wikidata for entity identifiers, labels, and descriptions.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '60000', priceUsdc: 0.06, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Base layer 2 network' },
    schema: {
      request: { query: { type: 'string', required: true, description: 'Search term or entity name' } },
      responseSample: { entities: [{ id: 'Q117188880', label: 'Base', description: 'Ethereum Layer 2 network developed by Coinbase' }] }
    }
  },
  {
    id: 'news_search', name: 'Recent Hacker News Submissions', category: 'news',
    url: '/v1/news/search', path: '/v1/news/search', method: 'POST',
    description: 'Search Hacker News submissions from the last 30 days via Algolia. Dates describe submissions, not original article publication.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '80000', priceUsdc: 0.08, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: 'Base network layer 2' },
    schema: {
      request: { query: { type: 'string', required: true, description: 'Topic or keyword to monitor' } },
      responseSample: { query: 'Base network layer 2', articles: [] }
    }
  },
  {
    id: 'research', name: 'Research Evidence Pack', category: 'research',
    url: '/v1/research', path: '/v1/research', method: 'POST',
    description: 'Retrieve academic works, Wikidata entities, and recent Hacker News submissions with source provenance; results are not independently verified.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '100000', priceUsdc: 0.10, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { topic: 'zero knowledge rollups and micropayments' },
    schema: {
      request: { topic: { type: 'string', required: true, description: 'Research subject or question' } },
      responseSample: { evidence: { scholarly_citations: [], wikidata_entities: [], recent_news: [] } }
    }
  },
  {
    id: 'verify', name: 'Claim Evidence Retrieval', category: 'research',
    url: '/v1/verify', path: '/v1/verify', method: 'POST',
    description: 'Retrieve related evidence for a claim. Search relevance alone cannot establish truth; the verdict is INSUFFICIENT pending independent assessment.',
    network: 'base', chainId: 8453, asset: BASE_USDC_MAINNET, assetSymbol: 'USDC',
    amount: '120000', priceUsdc: 0.12, payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { claim: 'Base is an Ethereum Layer 2 rollup developed by Coinbase' },
    schema: {
      request: { claim: { type: 'string', required: true, description: 'Assertion or factual statement to investigate' } },
      responseSample: { verdict: 'INSUFFICIENT', heuristic_metrics: { confidence: null } }
    }
  }
];
