// src/server/x402Engine.ts
import { randomBytes } from "node:crypto";
import { PaymentPayloadV2Schema, PaymentRequirementsV2Schema, z } from "@x402/core/schemas";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { eip3009ABI } from "@x402/evm";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress as getAddress2,
  http,
  keccak256,
  parseAbi,
  parseEventLogs
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

// src/shared/resources.ts
import { getAddress } from "viem";
var BASE_USDC_MAINNET = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
var BASE_USDC_SEPOLIA = getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
var DEFAULT_TREASURY_ADDRESS = getAddress("0x420f9F9deA7fA318eA8996C8aA00ad9738D98072");
var PAYMENT_TIMEOUT_SECONDS = 300;
var RELAY_RESOURCES = [
  {
    id: "academic_search",
    name: "Academic Search",
    category: "academic",
    url: "/v1/academic/search",
    path: "/v1/academic/search",
    method: "POST",
    description: "Search scholarly literature via OpenAlex with normalized DOIs, citations, authors, and open-access status.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "80000",
    priceUsdc: 0.08,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: "cryptographic payment channel layer 2", limit: 3 },
    schema: {
      request: {
        query: { type: "string", required: true, description: "Keywords or academic subject" },
        limit: { type: "number", required: false, description: "Number of works (1-20)" }
      },
      responseSample: { query: "cryptographic payment channel layer 2", total_results: 142, results: [{ title: "Example scholarly work", doi: null }] }
    }
  },
  {
    id: "academic_work",
    name: "Academic Work DOI",
    category: "academic",
    url: "/v1/academic/work",
    path: "/v1/academic/work",
    method: "POST",
    description: "Retrieve detailed scholarly work and citation metrics by digital object identifier (DOI).",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "60000",
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { doi: "10.1038/s41586-020-2649-2" },
    schema: {
      request: { doi: { type: "string", required: true, description: "Digital Object Identifier" } },
      responseSample: { doi: "https://doi.org/10.1038/s41586-020-2649-2", title: "Example scholarly work", cited_by_count: 320 }
    }
  },
  {
    id: "crypto_price",
    name: "Crypto Price & 24h",
    category: "crypto",
    url: "/v1/crypto/price",
    path: "/v1/crypto/price",
    method: "POST",
    description: "Spot prices and 24-hour percentage changes via CoinGecko in the requested quote currency.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "40000",
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ["ethereum", "bitcoin"], vsCurrency: "usd" },
    schema: {
      request: {
        assets: { type: "array of string", required: true, description: 'CoinGecko IDs (e.g. ["ethereum", "bitcoin"])' },
        vsCurrency: { type: "string", required: false, description: 'Quote currency (default: "usd")' }
      },
      responseSample: { quote_currency: "USD", prices: [{ asset: "ethereum", price: 2620.45, change_24h_percent: 2.1 }] }
    }
  },
  {
    id: "crypto_market",
    name: "Crypto Market Cap & Volume",
    category: "crypto",
    url: "/v1/crypto/market",
    path: "/v1/crypto/market",
    method: "POST",
    description: "CoinGecko USD market capitalization, rank, 24h trading volume, circulating supply, and all-time high.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "60000",
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { assets: ["ethereum", "bitcoin"] },
    schema: {
      request: { assets: { type: "array of string", required: true, description: "CoinGecko asset identifiers" } },
      responseSample: { market_data: [{ symbol: "ETH", current_price: 2620.45, market_cap: 315e9 }] }
    }
  },
  {
    id: "fx_rates",
    name: "Foreign Exchange Rates",
    category: "market",
    url: "/v1/fx/rates",
    path: "/v1/fx/rates",
    method: "POST",
    description: "European Central Bank reference exchange rates via Frankfurter for supported fiat currencies.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "40000",
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { baseCurrency: "USD", targets: ["EUR", "GBP", "JPY", "CAD"] },
    schema: {
      request: {
        baseCurrency: { type: "string", required: false, description: "Base 3-letter currency code (default: USD)" },
        targets: { type: "array of string", required: false, description: "List of target currency codes" }
      },
      responseSample: { base: "USD", rates: { EUR: 0.92, GBP: 0.77, JPY: 152.4 } }
    }
  },
  {
    id: "weather",
    name: "Weather & Multi-day Forecast",
    category: "weather",
    url: "/v1/weather",
    path: "/v1/weather",
    method: "POST",
    description: "Current conditions and a 3-day forecast for supplied coordinates via Open-Meteo.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "50000",
    priceUsdc: 0.05,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { latitude: 37.7749, longitude: -122.4194 },
    schema: {
      request: {
        latitude: { type: "number", required: true, description: "Latitude coordinate" },
        longitude: { type: "number", required: true, description: "Longitude coordinate" }
      },
      responseSample: { current: { temperature_c: 18.5, humidity_percent: 62 }, forecast_daily: [{ max_temp_c: 21 }] }
    }
  },
  {
    id: "geocode",
    name: "Forward Geocoding",
    category: "geo",
    url: "/v1/geocode",
    path: "/v1/geocode",
    method: "POST",
    description: "Forward place-name geocoding to coordinates and administrative boundaries via Photon / OSM.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "40000",
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: "Coinbase Headquarters San Francisco" },
    schema: {
      request: { query: { type: "string", required: true, description: "Location, city, address or landmark" } },
      responseSample: { features: [{ name: "San Francisco", country: "United States", coordinates: { latitude: 37.7749, longitude: -122.4194 } }] }
    }
  },
  {
    id: "holidays",
    name: "Public Holidays Registry",
    category: "knowledge",
    url: "/v1/holidays",
    path: "/v1/holidays",
    method: "POST",
    description: "National and regional public holiday schedules and observance dates via Nager.Date.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "40000",
    priceUsdc: 0.04,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { countryCode: "US", year: (/* @__PURE__ */ new Date()).getUTCFullYear() },
    schema: {
      request: {
        countryCode: { type: "string", required: true, description: "ISO 2-letter country code" },
        year: { type: "number", required: false, description: "Year (default: current UTC year)" }
      },
      responseSample: { country_code: "US", holidays: [{ date: "2026-07-04", name: "Independence Day", global: true }] }
    }
  },
  {
    id: "knowledge_search",
    name: "Wikidata Knowledge Entities",
    category: "knowledge",
    url: "/v1/knowledge/search",
    path: "/v1/knowledge/search",
    method: "POST",
    description: "Search Wikidata for entity identifiers, labels, and descriptions.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "60000",
    priceUsdc: 0.06,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: "Base layer 2 network" },
    schema: {
      request: { query: { type: "string", required: true, description: "Search term or entity name" } },
      responseSample: { entities: [{ id: "Q117188880", label: "Base", description: "Ethereum Layer 2 network developed by Coinbase" }] }
    }
  },
  {
    id: "news_search",
    name: "Recent Hacker News Submissions",
    category: "news",
    url: "/v1/news/search",
    path: "/v1/news/search",
    method: "POST",
    description: "Search Hacker News submissions from the last 30 days via Algolia. Dates describe submissions, not original article publication.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "80000",
    priceUsdc: 0.08,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { query: "Base network layer 2" },
    schema: {
      request: { query: { type: "string", required: true, description: "Topic or keyword to monitor" } },
      responseSample: { query: "Base network layer 2", articles: [] }
    }
  },
  {
    id: "research",
    name: "Research Evidence Pack",
    category: "research",
    url: "/v1/research",
    path: "/v1/research",
    method: "POST",
    description: "Retrieve academic works, Wikidata entities, and recent Hacker News submissions with source provenance; results are not independently verified.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "100000",
    priceUsdc: 0.1,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { topic: "zero knowledge rollups and micropayments" },
    schema: {
      request: { topic: { type: "string", required: true, description: "Research subject or question" } },
      responseSample: { evidence: { scholarly_citations: [], wikidata_entities: [], recent_news: [] } }
    }
  },
  {
    id: "verify",
    name: "Claim Evidence Retrieval",
    category: "research",
    url: "/v1/verify",
    path: "/v1/verify",
    method: "POST",
    description: "Retrieve related evidence for a claim. Search relevance alone cannot establish truth; the verdict is INSUFFICIENT pending independent assessment.",
    network: "base",
    chainId: 8453,
    asset: BASE_USDC_MAINNET,
    assetSymbol: "USDC",
    amount: "120000",
    priceUsdc: 0.12,
    payTo: DEFAULT_TREASURY_ADDRESS,
    defaultParams: { claim: "Base is an Ethereum Layer 2 rollup developed by Coinbase" },
    schema: {
      request: { claim: { type: "string", required: true, description: "Assertion or factual statement to investigate" } },
      responseSample: { verdict: "INSUFFICIENT", heuristic_metrics: { confidence: null } }
    }
  }
];

// src/server/providers.ts
var PROVIDER_TIMEOUT_MS = 5e3;
var HEALTH_TIMEOUT_MS = 2500;
var HEALTH_CACHE_MS = 6e4;
var MAX_ITEMS = 10;
var NEWS_WINDOW_MS = 30 * 24 * 60 * 60 * 1e3;
function queryUrl(base2, params) {
  const url = new URL(base2);
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0) url.searchParams.set(key, String(value));
  }
  return url.toString();
}
async function fetchJson(url, init = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const host = new URL(url).hostname;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${host} timed out after ${timeoutMs}ms`));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) throw new Error(`${host} returned HTTP ${response.status}`);
        return await response.json();
      })(),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
function boundedText(value, name, maxLength = 1024) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`${name} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}
function boundedStrings(values, name) {
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_ITEMS) {
    throw new Error(`${name} must contain 1-${MAX_ITEMS} items`);
  }
  return Array.from(values, (value) => boundedText(value, name, 64));
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function getOpenAlexMailto() {
  return typeof process !== "undefined" ? process.env?.OPENALEX_EMAIL : void 0;
}
function getCoinGeckoHeaders() {
  const headers = { Accept: "application/json" };
  if (typeof process !== "undefined" && process.env?.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }
  return headers;
}
function openAlexWork(work) {
  return {
    id: work.id ?? null,
    doi: work.doi || null,
    title: work.title || "Untitled Paper",
    publication_year: work.publication_year ?? null,
    authors: (work.authorships || []).map((a) => a.author?.display_name).filter(Boolean),
    journal: work.primary_location?.source?.display_name || work.host_venue?.name || "N/A",
    cited_by_count: numberOrNull(work.cited_by_count),
    is_oa: typeof work.open_access?.is_oa === "boolean" ? work.open_access.is_oa : null,
    landing_page_url: work.primary_location?.landing_page_url || work.doi || work.id || null
  };
}
function crossrefWork(item) {
  const doi = item.DOI ? `https://doi.org/${item.DOI}` : null;
  return {
    id: doi || item.URL || null,
    doi,
    title: (Array.isArray(item.title) ? item.title[0] : item.title) || "Untitled Paper",
    publication_year: item.issued?.["date-parts"]?.[0]?.[0] ?? null,
    authors: (item.author || []).map((a) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean),
    journal: (Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"]) || "N/A",
    cited_by_count: numberOrNull(item["is-referenced-by-count"]),
    // Crossref links can be paywalled or text-mining links, not evidence of open access.
    is_oa: null,
    landing_page_url: item.URL || doi
  };
}
async function fetchAcademicSearch(query, limit = 5) {
  query = boundedText(query, "query");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("limit must be an integer from 1 to 20");
  }
  try {
    const data2 = await fetchJson(queryUrl("https://api.openalex.org/works", {
      search: query,
      "per-page": limit,
      mailto: getOpenAlexMailto()
    }));
    if (!Array.isArray(data2.results)) throw new Error("Invalid OpenAlex search response");
    return {
      query,
      provider: "OpenAlex",
      total_results: data2.meta?.count ?? data2.results.length,
      results: data2.results.slice(0, limit).map(openAlexWork),
      retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch {
  }
  const data = await fetchJson(queryUrl("https://api.crossref.org/works", { query, rows: limit }));
  if (!Array.isArray(data.message?.items)) throw new Error("Invalid Crossref search response");
  return {
    query,
    provider: "Crossref (Live Fallback)",
    total_results: data.message["total-results"] ?? data.message.items.length,
    results: data.message.items.slice(0, limit).map(crossrefWork),
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchAcademicWork(doi) {
  const cleanDoi = boundedText(doi, "doi", 2048).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(cleanDoi)) throw new Error("Invalid DOI");
  try {
    const work = await fetchJson(queryUrl(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`, {
      mailto: getOpenAlexMailto()
    }));
    if (!work.id) throw new Error("Invalid OpenAlex work response");
    return { ...openAlexWork(work), provider: "OpenAlex", retrieved_at: (/* @__PURE__ */ new Date()).toISOString() };
  } catch {
  }
  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
  if (!data.message || !data.message.DOI && !data.message.title) throw new Error("Invalid Crossref work response");
  return { ...crossrefWork(data.message), provider: "Crossref (Live Fallback)", retrieved_at: (/* @__PURE__ */ new Date()).toISOString() };
}
async function coinGeckoMarkets(assets, vsCurrency) {
  const ids = boundedStrings(assets, "assets").map((asset) => asset.toLowerCase());
  if (ids.some((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id))) throw new Error("assets must be CoinGecko IDs");
  if (new Set(ids).size !== ids.length) throw new Error("assets must not contain duplicates");
  const currency = boundedText(vsCurrency, "vsCurrency", 5).toLowerCase();
  if (!/^[a-z]{3,5}$/.test(currency)) throw new Error("Invalid quote currency");
  const data = await fetchJson(queryUrl("https://api.coingecko.com/api/v3/coins/markets", {
    vs_currency: currency,
    ids: ids.join(","),
    per_page: ids.length,
    page: 1,
    sparkline: "false"
  }), { headers: getCoinGeckoHeaders() });
  if (!Array.isArray(data)) throw new Error("Invalid CoinGecko market response");
  const byId = new Map(data.map((coin) => [coin.id, coin]));
  const missing = ids.filter((id) => !byId.has(id) || numberOrNull(byId.get(id).current_price) === null);
  if (missing.length) throw new Error(`CoinGecko missing requested assets or ${currency.toUpperCase()} prices: ${missing.join(", ")}`);
  return { currency, coins: ids.map((id) => byId.get(id)) };
}
async function fetchCryptoPrice(assets = ["ethereum", "bitcoin"], vsCurrency = "usd") {
  const { currency, coins } = await coinGeckoMarkets(assets, vsCurrency);
  return {
    quote_currency: currency.toUpperCase(),
    prices: coins.map((coin) => ({
      asset: coin.id,
      symbol: coin.symbol?.toUpperCase() ?? null,
      price: coin.current_price,
      change_24h_percent: numberOrNull(coin.price_change_percentage_24h),
      high_24h: numberOrNull(coin.high_24h),
      low_24h: numberOrNull(coin.low_24h),
      quote_volume_24h: numberOrNull(coin.total_volume)
    })),
    source: "CoinGecko",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchCryptoMarket(assets = ["ethereum", "bitcoin"]) {
  const { coins } = await coinGeckoMarkets(assets, "usd");
  return {
    quote_currency: "USD",
    market_data: coins.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol?.toUpperCase() ?? null,
      name: coin.name ?? null,
      current_price: coin.current_price,
      change_24h_percent: numberOrNull(coin.price_change_percentage_24h),
      market_cap: numberOrNull(coin.market_cap),
      market_cap_rank: numberOrNull(coin.market_cap_rank),
      total_volume_24h: numberOrNull(coin.total_volume),
      high_24h: numberOrNull(coin.high_24h),
      low_24h: numberOrNull(coin.low_24h),
      circulating_supply: numberOrNull(coin.circulating_supply),
      total_supply: numberOrNull(coin.total_supply),
      max_supply: numberOrNull(coin.max_supply),
      ath: numberOrNull(coin.ath),
      ath_date: coin.ath_date ?? null
    })),
    source: "CoinGecko",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchFxRates(baseCurrency = "USD", targets = ["EUR", "GBP", "JPY", "CAD"]) {
  const base2 = boundedText(baseCurrency, "baseCurrency", 3).toUpperCase();
  const currencies = boundedStrings(targets, "targets").map((target) => target.toUpperCase());
  if (![base2, ...currencies].every((currency) => /^[A-Z]{3}$/.test(currency))) throw new Error("Invalid FX currency code");
  if (new Set(currencies).size !== currencies.length) throw new Error("targets must not contain duplicates");
  const otherCurrencies = currencies.filter((currency) => currency !== base2);
  const data = await fetchJson(queryUrl("https://api.frankfurter.app/latest", {
    from: base2,
    to: otherCurrencies.length ? otherCurrencies.join(",") : void 0
  }));
  if (data.base !== base2 || !data.rates || typeof data.date !== "string") throw new Error("Invalid Frankfurter response");
  const missing = otherCurrencies.filter((currency) => !(typeof data.rates[currency] === "number" && Number.isFinite(data.rates[currency]) && data.rates[currency] > 0));
  if (missing.length) throw new Error(`Frankfurter missing requested rates: ${missing.join(", ")}`);
  return {
    base: data.base,
    date: data.date,
    rates: Object.fromEntries(currencies.map((currency) => [currency, currency === base2 ? 1 : data.rates[currency]])),
    source: "European Central Bank (Frankfurter)",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchWeather(latitude = 37.7749, longitude = -122.4194) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Invalid weather coordinates");
  const data = await fetchJson(queryUrl("https://api.open-meteo.com/v1/forecast", {
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 3,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  }));
  if (!data.current || !Array.isArray(data.daily?.time)) throw new Error("Invalid Open-Meteo response");
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    elevation_m: data.elevation,
    current: {
      temperature_c: numberOrNull(data.current.temperature_2m),
      humidity_percent: numberOrNull(data.current.relative_humidity_2m),
      wind_speed_kmh: numberOrNull(data.current.wind_speed_10m),
      weather_code: numberOrNull(data.current.weather_code)
    },
    forecast_daily: data.daily.time.slice(0, 3).map((date, i) => ({
      date,
      max_temp_c: numberOrNull(data.daily.temperature_2m_max?.[i]),
      min_temp_c: numberOrNull(data.daily.temperature_2m_min?.[i]),
      weather_code: numberOrNull(data.daily.weather_code?.[i])
    })),
    source: "Open-Meteo",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchGeocode(query) {
  query = boundedText(query, "query");
  try {
    const data2 = await fetchJson(queryUrl("https://photon.komoot.io/api/", { q: query, limit: 3 }));
    if (!Array.isArray(data2.features)) throw new Error("Invalid Photon response");
    return {
      query,
      features: data2.features.slice(0, 3).map((f) => ({
        name: f.properties.name,
        country: f.properties.country,
        city: f.properties.city || f.properties.name,
        state: f.properties.state,
        coordinates: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
        osm_type: f.properties.osm_type
      })),
      source: "Photon / OpenStreetMap",
      retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch {
  }
  const data = await fetchJson(queryUrl("https://nominatim.openstreetmap.org/search", {
    q: query,
    format: "json",
    limit: 3,
    addressdetails: 1
  }), { headers: { "User-Agent": "Relay-x402-Gateway/1.0" } });
  if (!Array.isArray(data)) throw new Error("Invalid Nominatim response");
  return {
    query,
    features: data.slice(0, 3).map((item) => ({
      name: item.name || item.display_name?.split(",")[0] || null,
      country: item.address?.country ?? null,
      city: item.address?.city || item.address?.town || item.address?.village || null,
      state: item.address?.state ?? null,
      coordinates: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
      osm_type: item.osm_type ?? null
    })),
    source: "Nominatim / OpenStreetMap (Live Fallback)",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchHolidays(countryCode = "US", year = (/* @__PURE__ */ new Date()).getUTCFullYear()) {
  const country = boundedText(countryCode, "countryCode", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("Invalid country code");
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error("year must be an integer from 1900 to 2100");
  const data = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${encodeURIComponent(year)}/${encodeURIComponent(country)}`);
  if (!Array.isArray(data)) throw new Error("Invalid Nager.Date response");
  return {
    country_code: country,
    year,
    holidays: data.map((holiday) => ({
      date: holiday.date,
      local_name: holiday.localName,
      name: holiday.name,
      global: holiday.global,
      counties: holiday.counties ?? null,
      types: holiday.types
    })),
    source: "Nager.Date",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchKnowledgeSearch(query) {
  query = boundedText(query, "query");
  const data = await fetchJson(queryUrl("https://www.wikidata.org/w/api.php", {
    action: "wbsearchentities",
    search: query,
    language: "en",
    format: "json",
    origin: "*",
    limit: 5
  }));
  if (!Array.isArray(data.search)) throw new Error("Invalid Wikidata response");
  return {
    query,
    entities: data.search.slice(0, 5).map((entity) => ({
      id: entity.id,
      label: entity.label,
      description: entity.description || "No description provided",
      concept_uri: entity.concepturi || `https://www.wikidata.org/entity/${encodeURIComponent(entity.id)}`,
      url: entity.url ? entity.url.startsWith("http") ? entity.url : `https:${entity.url}` : `https://www.wikidata.org/wiki/${encodeURIComponent(entity.id)}`
    })),
    source: "Wikidata",
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchNewsSearch(query) {
  query = boundedText(query, "query");
  const now = Date.now();
  const cutoff = now - NEWS_WINDOW_MS;
  const data = await fetchJson(queryUrl("https://hn.algolia.com/api/v1/search_by_date", {
    query,
    tags: "story",
    hitsPerPage: 5,
    numericFilters: `created_at_i>=${Math.ceil(cutoff / 1e3)},created_at_i<=${Math.floor(now / 1e3)}`
  }));
  if (!Array.isArray(data.hits)) throw new Error("Invalid Hacker News Algolia response");
  const articles = data.hits.flatMap((hit) => {
    const submittedAt = typeof hit.created_at_i === "number" ? hit.created_at_i * 1e3 : Date.parse(hit.created_at);
    if (!Number.isFinite(submittedAt) || submittedAt < cutoff || submittedAt > now) return [];
    const discussionUrl = queryUrl("https://news.ycombinator.com/item", { id: hit.objectID });
    let articleUrl;
    try {
      const url = new URL(hit.url);
      if (url.protocol === "https:" || url.protocol === "http:") articleUrl = url;
    } catch {
    }
    return [{
      title: hit.title,
      source: articleUrl?.hostname.replace(/^www\./, "") || "news.ycombinator.com",
      url: articleUrl?.toString() || discussionUrl,
      published_at: null,
      submitted_at: new Date(submittedAt).toISOString(),
      discussion_url: discussionUrl,
      submitted_by: hit.author ?? null,
      points: numberOrNull(hit.points),
      num_comments: numberOrNull(hit.num_comments),
      summary: null
    }];
  }).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).slice(0, 5);
  return {
    query,
    total_articles: articles.length,
    articles,
    source: "Hacker News submissions (Algolia)",
    date_basis: "Hacker News submission time; original article publication date is unknown",
    window_start: new Date(cutoff).toISOString(),
    window_end: new Date(now).toISOString(),
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fetchResearchPack(topic) {
  topic = boundedText(topic, "topic");
  const [academic, knowledge, news] = await Promise.all([
    fetchAcademicSearch(topic, 3),
    fetchKnowledgeSearch(topic),
    fetchNewsSearch(topic)
  ]);
  return {
    topic,
    provenance: {
      generated_by: "Relay Deterministic Multi-Source Aggregator",
      is_synthetic_mock: false,
      sources: {
        academic: { provider: academic.provider, retrieved_at: academic.retrieved_at },
        knowledge: { provider: knowledge.source, retrieved_at: knowledge.retrieved_at },
        news: { provider: news.source, retrieved_at: news.retrieved_at, window_start: news.window_start, window_end: news.window_end, date_basis: news.date_basis }
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    evidence: {
      scholarly_citations: academic.results,
      wikidata_entities: knowledge.entities,
      recent_news_and_events: news.articles
    },
    deterministic_summary: `Retrieved ${academic.results.length} scholarly records, ${knowledge.entities.length} Wikidata entities, and ${news.articles.length} recent Hacker News submissions for topic "${topic}". No claim verification or full-text assessment was performed.`
  };
}
async function fetchVerifyClaim(claim) {
  claim = boundedText(claim, "claim", 2048);
  const lower = claim.toLowerCase();
  const keywords = lower.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((word) => word.length > 3 && !["this", "that", "with", "from", "have", "were", "been", "which"].includes(word));
  const searchQuery = claim.slice(0, 1024);
  const [wikiCheck, academicCheck] = await Promise.allSettled([
    fetchKnowledgeSearch(searchQuery),
    fetchAcademicSearch(searchQuery, 2)
  ]);
  if (wikiCheck.status === "rejected" && academicCheck.status === "rejected") {
    throw new Error("Claim evidence retrieval failed across Wikidata and academic providers");
  }
  const wiki = wikiCheck.status === "fulfilled" ? wikiCheck.value : null;
  const academic = academicCheck.status === "fulfilled" ? academicCheck.value : null;
  const evidenceTrail = [
    {
      provider: wiki?.source ?? "Wikidata",
      matches_found: wiki?.entities.length ?? 0,
      status: wiki ? wiki.entities.length ? "Retrieved search results" : "No search results" : "Unavailable",
      results: wiki?.entities ?? [],
      retrieved_at: wiki?.retrieved_at ?? null
    },
    {
      provider: academic?.provider ?? "OpenAlex / Crossref",
      matches_found: academic?.results.length ?? 0,
      status: academic ? academic.results.length ? "Retrieved search results" : "No search results" : "Unavailable",
      results: academic?.results ?? [],
      retrieved_at: academic?.retrieved_at ?? null
    }
  ];
  return {
    claim,
    verdict: "INSUFFICIENT",
    method: "Search-result retrieval only; no entailment, contradiction, source-quality, or full-text assessment. Search matches are not proof and confidence is not estimated.",
    search_query: searchQuery,
    search_query_truncated: searchQuery.length !== claim.length,
    retrieval_complete: Boolean(wiki && academic),
    heuristic_metrics: {
      confidence: null,
      lexical_terms_extracted: keywords,
      negation_cue_detected: /\b(not|never|fake|false|refuses|cannot|untrue|denies|debunked)\b/.test(lower),
      live_sources_consulted: [wiki?.source, academic?.provider].filter((source) => Boolean(source)),
      live_evidence_count: evidenceTrail.reduce((count, entry) => count + entry.matches_found, 0)
    },
    evidence_trail: evidenceTrail,
    verified_at: null,
    retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function checkProviders() {
  const probes = [
    { name: "coinGecko", url: "https://api.coingecko.com/api/v3/ping", init: { headers: getCoinGeckoHeaders() }, role: "primary", valid: (data) => typeof data?.gecko_says === "string" },
    { name: "openAlex", url: queryUrl("https://api.openalex.org/works", { "per-page": 1, select: "id", mailto: getOpenAlexMailto() }), role: "primary", valid: (data) => Array.isArray(data?.results) },
    { name: "crossref", url: queryUrl("https://api.crossref.org/works", { rows: 1, select: "DOI" }), role: "fallback", valid: (data) => Array.isArray(data?.message?.items) },
    { name: "frankfurter", url: queryUrl("https://api.frankfurter.app/latest", { from: "USD", to: "EUR" }), role: "primary", valid: (data) => data?.base === "USD" && numberOrNull(data?.rates?.EUR) !== null && data.rates.EUR > 0 },
    { name: "openMeteo", url: queryUrl("https://api.open-meteo.com/v1/forecast", { latitude: 0, longitude: 0, current: "temperature_2m", forecast_days: 1 }), role: "primary", valid: (data) => numberOrNull(data?.current?.temperature_2m) !== null },
    { name: "photon", url: queryUrl("https://photon.komoot.io/api/", { q: "Berlin", limit: 1 }), role: "primary", valid: (data) => Array.isArray(data?.features) },
    { name: "nominatim", url: queryUrl("https://nominatim.openstreetmap.org/search", { q: "Berlin", format: "json", limit: 1 }), init: { headers: { "User-Agent": "Relay-x402-Gateway/1.0" } }, role: "fallback", valid: (data) => Array.isArray(data) },
    { name: "nagerDate", url: `https://date.nager.at/api/v3/PublicHolidays/${(/* @__PURE__ */ new Date()).getUTCFullYear()}/DE`, role: "primary", valid: (data) => Array.isArray(data) },
    { name: "wikidata", url: queryUrl("https://www.wikidata.org/w/api.php", { action: "wbsearchentities", search: "Berlin", language: "en", format: "json", limit: 1 }), role: "primary", valid: (data) => Array.isArray(data?.search) },
    { name: "hackerNews", url: queryUrl("https://hn.algolia.com/api/v1/search_by_date", { tags: "story", hitsPerPage: 1 }), role: "primary", valid: (data) => Array.isArray(data?.hits) }
  ];
  const checks = {};
  let next = 0;
  const worker = async () => {
    while (next < probes.length) {
      const probe = probes[next++];
      const started = performance.now();
      try {
        const data = await fetchJson(probe.url, probe.init, HEALTH_TIMEOUT_MS);
        if (!probe.valid(data)) throw new Error("Unexpected provider probe response");
        checks[probe.name] = { status: "healthy", latencyMs: Math.round(performance.now() - started), role: probe.role };
      } catch (error) {
        checks[probe.name] = {
          status: "degraded",
          latencyMs: Math.round(performance.now() - started),
          role: probe.role,
          error: error instanceof Error ? error.message : "Provider probe failed"
        };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return {
    status: Object.values(checks).every((check) => check.status === "healthy") ? "operational" : "degraded",
    gateway: "Relay x402 Gateway",
    scope: "One lightweight availability probe per listed primary/fallback provider; not all resource routes, data correctness, payment settlement, blockchain health, or gateway uptime.",
    providers: checks,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    cacheTtlSeconds: HEALTH_CACHE_MS / 1e3
  };
}
var healthCache;
var healthInFlight;
async function getProvidersHealth() {
  if (healthCache && Date.now() < healthCache.expiresAt) return healthCache.value;
  if (!healthInFlight) {
    healthInFlight = checkProviders().then((value) => {
      healthCache = { value, expiresAt: Date.now() + HEALTH_CACHE_MS };
      return value;
    }).finally(() => {
      healthInFlight = void 0;
    });
  }
  return healthInFlight;
}

// src/server/x402Engine.ts
var configuredNetwork = process.env.RELAY_NETWORK ?? "base";
if (configuredNetwork !== "base" && configuredNetwork !== "base-sepolia") {
  throw new Error("RELAY_NETWORK must be base or base-sepolia");
}
var treasury = process.env.RELAY_TREASURY_ADDRESS ?? DEFAULT_TREASURY_ADDRESS;
if (!/^0x[0-9a-fA-F]{40}$/.test(treasury) || /^0x0{40}$/i.test(treasury)) {
  throw new Error("RELAY_TREASURY_ADDRESS must be a nonzero address");
}
var RELAY_RESOURCES2 = RELAY_RESOURCES.map((resource) => ({
  ...resource,
  network: configuredNetwork,
  chainId: configuredNetwork === "base" ? base.id : baseSepolia.id,
  asset: configuredNetwork === "base" ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA,
  payTo: getAddress2(treasury)
}));
var address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).refine((value) => !/^0x0{40}$/i.test(value));
var uint256 = z.string().refine((value) => /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < 1n << 256n);
var paymentSchema = PaymentPayloadV2Schema.omit({ extensions: true }).strict().extend({
  accepted: PaymentRequirementsV2Schema.strict().extend({
    scheme: z.literal("exact"),
    network: z.enum(["eip155:8453", "eip155:84532"]),
    asset: address,
    payTo: address,
    amount: uint256,
    maxTimeoutSeconds: z.literal(PAYMENT_TIMEOUT_SECONDS),
    extra: z.object({ name: z.enum(["USD Coin", "USDC"]), version: z.literal("2") }).strict()
  }),
  payload: z.object({
    signature: z.string().regex(/^0x(?:[0-9a-fA-F]{2}){1,4096}$/),
    authorization: z.object({
      from: address,
      to: address,
      value: uint256,
      validAfter: uint256,
      validBefore: uint256,
      nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
    }).strict()
  }).strict()
});
var messages = {
  invalid_payment: "Payment does not match the required signed authorization.",
  payment_expired: "Payment authorization has expired or is too close to expiry.",
  payment_not_yet_valid: "Payment authorization is not yet valid.",
  payment_replayed: "Payment authorization has already been used or cancelled.",
  payment_configuration_error: "Payment settlement is not configured correctly.",
  payment_verification_unavailable: "Payment verification is temporarily unavailable.",
  settlement_failed: "Payment settlement was not confirmed as successful.",
  settlement_pending: "Payment may have been submitted. Reconcile the transaction before paying again.",
  settlement_in_progress: "This authorization is already being settled. Do not pay again."
};
var PaymentError = class extends Error {
  constructor(code) {
    super(messages[code]);
    this.code = code;
  }
  code;
};
function failure(errorCode, payer = "", amount = "0") {
  return { valid: false, payer, amount, errorCode, error: messages[errorCode] };
}
function reasonCode(reason) {
  if (!reason) return "invalid_payment";
  if (reason === "invalid_exact_evm_nonce_already_used" || reason.includes("nonce_already_used") || reason === "payment_replayed") return "payment_replayed";
  if (reason === "invalid_exact_evm_payload_authorization_valid_before" || reason.includes("valid_before") || reason === "payment_expired") return "payment_expired";
  if (reason === "invalid_exact_evm_payload_authorization_valid_after" || reason.includes("valid_after") || reason === "payment_not_yet_valid") return "payment_not_yet_valid";
  if (reason === "invalid_exact_evm_failed_to_verify_signature" || reason === "invalid_exact_evm_transaction_simulation_failed") {
    return "payment_verification_unavailable";
  }
  return "invalid_payment";
}
function resourceUrl(resource, origin = process.env.GATEWAY_ORIGIN ?? "https://relayx402.vercel.app") {
  const url = new URL(resource.url, origin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new PaymentError("payment_configuration_error");
  }
  return url.href;
}
function requirementsFor(resource) {
  const isBase = resource.network === "base";
  const asset = isBase ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA;
  if (!isBase && resource.network !== "base-sepolia" || resource.chainId !== (isBase ? base.id : baseSepolia.id) || resource.asset.toLowerCase() !== asset.toLowerCase() || !address.safeParse(resource.payTo).success || !uint256.safeParse(resource.amount).success || BigInt(resource.amount) === 0n) {
    throw new PaymentError("payment_configuration_error");
  }
  return {
    scheme: "exact",
    network: isBase ? "eip155:8453" : "eip155:84532",
    asset,
    amount: resource.amount,
    payTo: getAddress2(resource.payTo),
    maxTimeoutSeconds: PAYMENT_TIMEOUT_SECONDS,
    extra: { name: isBase ? "USD Coin" : "USDC", version: "2" }
  };
}
function generate402Challenge(resource, network = resource.network, origin) {
  const selected = network === resource.network ? resource : {
    ...resource,
    network,
    chainId: network === "base" ? base.id : baseSepolia.id,
    asset: network === "base" ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA
  };
  return {
    x402Version: 2,
    error: "Payment Required",
    resource: { url: resourceUrl(resource, origin), description: resource.description, mimeType: "application/json" },
    accepts: [requirementsFor(selected)]
  };
}
function validateProof(input, resource) {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return failure("invalid_payment");
  const proof = parsed.data;
  const auth = proof.payload.authorization;
  try {
    const requirements = requirementsFor(resource);
    const accepted = proof.accepted;
    if (accepted.network !== requirements.network || accepted.scheme !== requirements.scheme || accepted.asset.toLowerCase() !== requirements.asset.toLowerCase() || accepted.payTo.toLowerCase() !== requirements.payTo.toLowerCase() || accepted.amount !== requirements.amount || auth.value !== requirements.amount || auth.to.toLowerCase() !== requirements.payTo.toLowerCase() || accepted.extra.name !== requirements.extra.name || accepted.extra.version !== requirements.extra.version || proof.resource && proof.resource.url !== resourceUrl(resource)) {
      return failure("invalid_payment", auth.from, resource.amount);
    }
    const now = BigInt(Math.floor(Date.now() / 1e3));
    if (BigInt(auth.validBefore) < now + 6n) return failure("payment_expired", auth.from, resource.amount);
    if (BigInt(auth.validAfter) >= now) return failure("payment_not_yet_valid", auth.from, resource.amount);
    if (BigInt(auth.validBefore) > now + BigInt(PAYMENT_TIMEOUT_SECONDS) || BigInt(auth.validBefore) <= BigInt(auth.validAfter)) {
      return failure("invalid_payment", auth.from, resource.amount);
    }
    return { proof, requirements };
  } catch (error) {
    return failure(error instanceof PaymentError ? error.code : "payment_configuration_error", auth.from, resource.amount);
  }
}
var settlementEvents = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)"
]);
var inFlight = /* @__PURE__ */ new Set();
var pending = /* @__PURE__ */ new Map();
var nonceQueues = /* @__PURE__ */ new Map();
function authorizationKey(proof) {
  const auth = proof.payload.authorization;
  return `${proof.accepted.network}:${proof.accepted.asset}:${auth.from}:${auth.nonce}`.toLowerCase();
}
function pendingFor(key) {
  for (const [id, entry] of pending) if (entry.expiresAt < Date.now()) pending.delete(id);
  return pending.get(key);
}
async function serializeSend(key, send) {
  const previous = nonceQueues.get(key) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  nonceQueues.set(key, tail);
  await previous;
  try {
    return await send();
  } finally {
    release();
    if (nonceQueues.get(key) === tail) nonceQueues.delete(key);
  }
}
var PRIMER_FACILITATOR_URL = "https://x402.primer.systems";
function getFacilitatorTarget() {
  const url = process.env.FACILITATOR_URL;
  if (url) {
    if (url === "self-hosted" || url === "local") {
      const key = process.env.RELAY_FACILITATOR_KEY;
      if (!key) throw new PaymentError("payment_configuration_error");
      return { type: "local", key };
    }
    return { type: "http", url };
  }
  if (process.env.RELAY_FACILITATOR_KEY) {
    return { type: "local", key: process.env.RELAY_FACILITATOR_KEY };
  }
  if (process.env.NODE_ENV === "test") {
    throw new PaymentError("payment_configuration_error");
  }
  return { type: "http", url: PRIMER_FACILITATOR_URL };
}
function createFacilitator(resource, proof, attempt) {
  const target = getFacilitatorTarget();
  if (target.type !== "local") throw new PaymentError("payment_configuration_error");
  const key = target.key;
  const normalizedKey = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) throw new PaymentError("payment_configuration_error");
  let account;
  try {
    account = privateKeyToAccount(normalizedKey);
  } catch {
    throw new PaymentError("payment_configuration_error");
  }
  const chain = resource.network === "base" ? base : baseSepolia;
  const rpcUrl = process.env.BASE_RPC_URL ?? chain.rpcUrls.default.http[0];
  const timeout = Number(process.env.RELAY_SETTLEMENT_TIMEOUT_MS ?? 15e3);
  try {
    if (!["https:", "http:"].includes(new URL(rpcUrl).protocol) || !Number.isInteger(timeout) || timeout < 100 || timeout > 3e4) {
      throw new Error();
    }
  } catch {
    throw new PaymentError("payment_configuration_error");
  }
  const transport = http(rpcUrl, { timeout: 5e3, retryCount: 0 });
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, account, transport });
  const auth = proof.payload.authorization;
  const token = getAddress2(resource.asset);
  const signer = {
    getAddresses: () => [account.address],
    getCode: (args) => publicClient.getCode(args),
    readContract: (args) => publicClient.readContract({ ...args, abi: args.abi, account: args.account ?? account.address }),
    verifyTypedData: (args) => publicClient.verifyTypedData(args),
    sendTransaction: async () => {
      throw new PaymentError("invalid_payment");
    },
    writeContract: async (args) => {
      if (!attempt || args.functionName !== "transferWithAuthorization" || args.address.toLowerCase() !== token.toLowerCase()) {
        throw new PaymentError("invalid_payment");
      }
      return serializeSend(`${chain.id}:${account.address}`, async () => {
        const data = `${encodeFunctionData({ abi: args.abi, functionName: args.functionName, args: args.args })}${randomBytes(16).toString("hex")}`;
        const request = await walletClient.prepareTransactionRequest({ account, chain, type: "eip1559", to: token, data, gas: args.gas });
        const serialized = await account.signTransaction({
          type: "eip1559",
          chainId: chain.id,
          to: token,
          data,
          nonce: request.nonce,
          gas: request.gas,
          maxFeePerGas: request.maxFeePerGas,
          maxPriorityFeePerGas: request.maxPriorityFeePerGas
        });
        attempt.txHash = keccak256(serialized);
        const returnedHash = await walletClient.sendRawTransaction({ serializedTransaction: serialized });
        if (returnedHash.toLowerCase() !== attempt.txHash.toLowerCase()) throw new PaymentError("settlement_pending");
        return attempt.txHash;
      });
    },
    waitForTransactionReceipt: async ({ hash }) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2, timeout, pollingInterval: 1e3, checkReplacement: false });
      if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase() || !Array.isArray(receipt.logs)) {
        throw new PaymentError("settlement_pending");
      }
      if (receipt.status === "success") {
        const logs = receipt.logs.filter((log) => log.address.toLowerCase() === token.toLowerCase());
        const transfers = parseEventLogs({ abi: settlementEvents, eventName: "Transfer", logs });
        const authorizations = parseEventLogs({ abi: settlementEvents, eventName: "AuthorizationUsed", logs });
        const transferred = transfers.some((log) => log.args.from.toLowerCase() === auth.from.toLowerCase() && log.args.to.toLowerCase() === auth.to.toLowerCase() && log.args.value === BigInt(auth.value));
        const consumed = authorizations.some((log) => log.args.authorizer.toLowerCase() === auth.from.toLowerCase() && log.args.nonce.toLowerCase() === auth.nonce.toLowerCase());
        const nonceUsed = await publicClient.readContract({
          address: token,
          abi: eip3009ABI,
          functionName: "authorizationState",
          args: [getAddress2(auth.from), auth.nonce],
          blockNumber: receipt.blockNumber
        });
        if (!transferred || !consumed || nonceUsed !== true) throw new PaymentError("settlement_pending");
      }
      return receipt;
    }
  };
  const scheme = new ExactEvmScheme(signer, { simulateInSettle: true });
  return { publicClient, scheme, chain };
}
async function verifyOnChain(context, proof, requirements) {
  const auth = proof.payload.authorization;
  if (await context.publicClient.getChainId() !== context.chain.id) throw new PaymentError("payment_configuration_error");
  const used = await context.publicClient.readContract({
    address: getAddress2(requirements.asset),
    abi: eip3009ABI,
    functionName: "authorizationState",
    args: [getAddress2(auth.from), auth.nonce]
  });
  if (used === true) return failure("payment_replayed", auth.from, requirements.amount);
  if (used !== false) throw new PaymentError("payment_verification_unavailable");
  const result = await context.scheme.verify(proof, requirements);
  return result.isValid ? { valid: true, payer: auth.from, amount: requirements.amount } : failure(reasonCode(result.invalidReason), auth.from, requirements.amount);
}
async function verifyWithHttpFacilitator(url, proof, requirements) {
  const auth = proof.payload.authorization;
  const timeoutMs = Number(process.env.RELAY_SETTLEMENT_TIMEOUT_MS ?? 15e3);
  const client = new HTTPFacilitatorClient({ url, timeoutMs: Math.min(Math.max(timeoutMs, 1e3), 3e4) });
  try {
    const result = await client.verify(proof, requirements);
    if (result.isValid) {
      return { valid: true, payer: auth.from, amount: requirements.amount };
    }
    return failure(reasonCode(result.invalidReason), auth.from, requirements.amount);
  } catch (error) {
    const invalidReason = error?.invalidReason ?? error?.response?.data?.invalidReason;
    if (invalidReason) {
      return failure(reasonCode(invalidReason), auth.from, requirements.amount);
    }
    return failure("payment_verification_unavailable", auth.from, requirements.amount);
  }
}
async function settleWithHttpFacilitator(url, proof, requirements) {
  const auth = proof.payload.authorization;
  const timeoutMs = Number(process.env.RELAY_SETTLEMENT_TIMEOUT_MS ?? 15e3);
  const client = new HTTPFacilitatorClient({ url, timeoutMs: Math.min(Math.max(timeoutMs, 1e3), 3e4) });
  let settled;
  try {
    settled = await client.settle(proof, requirements);
  } catch (error) {
    if (error && typeof error === "object" && ("errorReason" in error || "transaction" in error)) {
      settled = error;
    } else {
      const errorData = error?.response?.data ?? error?.cause?.response?.data;
      if (errorData && typeof errorData === "object" && ("transaction" in errorData || "errorReason" in errorData)) {
        settled = errorData;
      } else {
        return {
          ...failure("settlement_pending", auth.from, requirements.amount),
          network: requirements.network
        };
      }
    }
  }
  const txHash = settled.transaction && /^0x[0-9a-fA-F]{64}$/.test(settled.transaction) ? settled.transaction : void 0;
  if (settled.success && txHash) {
    return {
      valid: true,
      payer: auth.from,
      amount: requirements.amount,
      txHash,
      settledAt: (/* @__PURE__ */ new Date()).toISOString(),
      network: requirements.network
    };
  }
  const reason = settled.errorReason || "";
  const code = txHash && !settled.success || reason === "settlement_pending" ? "settlement_pending" : reason.includes("nonce_already_used") || reason.includes("already_used") ? "payment_replayed" : "settlement_failed";
  return {
    ...failure(code, auth.from, requirements.amount),
    txHash,
    network: requirements.network
  };
}
async function verifyPaymentProof(input, resource) {
  const checked = validateProof(input, resource);
  if (!("proof" in checked)) return checked;
  const { proof, requirements } = checked;
  const key = authorizationKey(proof);
  const existing = pendingFor(key);
  if (existing) return { ...failure("settlement_pending", proof.payload.authorization.from, resource.amount), txHash: existing.txHash };
  if (inFlight.has(key)) return failure("settlement_in_progress", proof.payload.authorization.from, resource.amount);
  let target;
  try {
    target = getFacilitatorTarget();
  } catch (error) {
    return failure(error instanceof PaymentError ? error.code : "payment_configuration_error", proof.payload.authorization.from, resource.amount);
  }
  if (target.type === "http") {
    return verifyWithHttpFacilitator(target.url, proof, requirements);
  }
  try {
    return await verifyOnChain(createFacilitator(resource, proof), proof, requirements);
  } catch (error) {
    return failure(error instanceof PaymentError ? error.code : "payment_verification_unavailable", proof.payload.authorization.from, resource.amount);
  }
}
async function settlePaymentProof(input, resource) {
  const checked = validateProof(input, resource);
  if (!("proof" in checked)) return checked;
  const { proof, requirements } = checked;
  const auth = proof.payload.authorization;
  const key = authorizationKey(proof);
  const existing = pendingFor(key);
  if (existing) return { ...failure("settlement_pending", auth.from, resource.amount), txHash: existing.txHash, network: requirements.network };
  if (inFlight.has(key)) return failure("settlement_in_progress", auth.from, resource.amount);
  inFlight.add(key);
  let target;
  try {
    target = getFacilitatorTarget();
  } catch (error) {
    inFlight.delete(key);
    return failure(error instanceof PaymentError ? error.code : "payment_configuration_error", auth.from, resource.amount);
  }
  if (target.type === "http") {
    try {
      const verified = await verifyWithHttpFacilitator(target.url, proof, requirements);
      if (!verified.valid) return verified;
      const settledResult = await settleWithHttpFacilitator(target.url, proof, requirements);
      if (settledResult.errorCode === "settlement_pending" && settledResult.txHash) {
        pending.set(key, { txHash: settledResult.txHash, expiresAt: Number(auth.validBefore) * 1e3 + 6e4 });
      }
      return settledResult;
    } finally {
      inFlight.delete(key);
    }
  }
  const attempt = {};
  let result;
  try {
    const context = createFacilitator(resource, proof, attempt);
    const verified = await verifyOnChain(context, proof, requirements);
    if (!verified.valid) return verified;
    const settled = await context.scheme.settle(proof, requirements);
    if (settled.success && attempt.txHash && settled.transaction.toLowerCase() === attempt.txHash.toLowerCase()) {
      return {
        valid: true,
        payer: auth.from,
        amount: requirements.amount,
        txHash: attempt.txHash,
        settledAt: (/* @__PURE__ */ new Date()).toISOString(),
        network: requirements.network
      };
    }
    const code = settled.errorReason === "settlement_pending" || attempt.txHash && !settled.transaction ? "settlement_pending" : settled.errorReason === "invalid_exact_evm_nonce_already_used" ? "payment_replayed" : "settlement_failed";
    result = { ...failure(code, auth.from, resource.amount), txHash: attempt.txHash, network: requirements.network };
  } catch (error) {
    result = {
      ...failure(attempt.txHash ? "settlement_pending" : error instanceof PaymentError ? error.code : "settlement_failed", auth.from, resource.amount),
      txHash: attempt.txHash,
      network: requirements.network
    };
  } finally {
    inFlight.delete(key);
  }
  if (result.errorCode === "settlement_pending" && attempt.txHash) {
    pending.set(key, { txHash: attempt.txHash, expiresAt: Number(auth.validBefore) * 1e3 + 6e4 });
  }
  return result;
}
async function dispatchResourceRequest(resourceId, params) {
  switch (resourceId) {
    case "academic_search":
      return fetchAcademicSearch(params.query, params.limit ?? 3);
    case "academic_work":
      return fetchAcademicWork(params.doi);
    case "crypto_price":
      return fetchCryptoPrice(params.assets, params.vsCurrency ?? "usd");
    case "crypto_market":
      return fetchCryptoMarket(params.assets);
    case "fx_rates":
      return fetchFxRates(params.baseCurrency ?? "USD", params.targets ?? ["EUR", "GBP", "JPY"]);
    case "weather":
      return fetchWeather(params.latitude, params.longitude);
    case "geocode":
      return fetchGeocode(params.query);
    case "holidays":
      return fetchHolidays(params.countryCode, params.year ?? (/* @__PURE__ */ new Date()).getUTCFullYear());
    case "knowledge_search":
      return fetchKnowledgeSearch(params.query);
    case "news_search":
      return fetchNewsSearch(params.query);
    case "research":
      return fetchResearchPack(params.topic);
    case "verify":
      return fetchVerifyClaim(params.claim);
    case "health":
      return getProvidersHealth();
    default:
      throw new Error(`Unknown resource ID: ${resourceId}`);
  }
}
function getWellKnownManifest(origin) {
  let facilitatorLabel = `Primer Systems public x402 facilitator (${PRIMER_FACILITATOR_URL})`;
  try {
    const target = getFacilitatorTarget();
    if (target.type === "http") {
      facilitatorLabel = target.url === PRIMER_FACILITATOR_URL ? `Primer Systems public x402 facilitator (${target.url})` : `x402 HTTP facilitator (${target.url})`;
    } else {
      facilitatorLabel = "Relay self-hosted @x402/evm facilitator";
    }
  } catch {
  }
  return {
    x402Version: 2,
    name: "Relay",
    description: "Pay-per-use information retrieval with confirmed USDC payments using x402 v2 exact.",
    network: configuredNetwork === "base" ? "eip155:8453" : "eip155:84532",
    chainId: configuredNetwork === "base" ? base.id : baseSepolia.id,
    facilitator: facilitatorLabel,
    resources: RELAY_RESOURCES2.map((resource) => ({
      ...requirementsFor(resource),
      url: resourceUrl(resource, origin),
      method: resource.method,
      description: resource.description,
      mimeType: "application/json"
    }))
  };
}

// src/shared/validation.ts
var MAX_REQUEST_BYTES = 16 * 1024;
var limits = {
  query: { minLength: 1, maxLength: 1024 },
  topic: { minLength: 1, maxLength: 1024 },
  claim: { minLength: 1, maxLength: 2048 },
  doi: { minLength: 7, maxLength: 2048, pattern: "^(?:https?://(?:dx\\.)?doi\\.org/)?10\\.\\d{4,9}/\\S+$" },
  assets: { minItems: 1, maxItems: 10, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]*$" } },
  targets: { minItems: 1, maxItems: 10, uniqueItems: true, items: { type: "string", pattern: "^[A-Z]{3}$" } },
  vsCurrency: { pattern: "^[a-z]{3,5}$" },
  baseCurrency: { pattern: "^[A-Z]{3}$" },
  countryCode: { pattern: "^[A-Z]{2}$" },
  limit: { type: "integer", minimum: 1, maximum: 20 },
  year: { type: "integer", minimum: 1900, maximum: 2100 },
  latitude: { minimum: -90, maximum: 90 },
  longitude: { minimum: -180, maximum: 180 }
};
function getRequestSchema(resource) {
  const properties = {};
  for (const [name, field] of Object.entries(resource.schema.request)) {
    properties[name] = {
      type: field.type.includes("array") ? "array" : field.type,
      description: field.description,
      ...limits[name]
    };
    if (!field.required && Object.prototype.hasOwnProperty.call(resource.defaultParams, name)) {
      properties[name].default = name === "year" ? (/* @__PURE__ */ new Date()).getUTCFullYear() : resource.defaultParams[name];
    }
  }
  return {
    type: "object",
    properties,
    required: Object.entries(resource.schema.request).filter(([, field]) => field.required).map(([name]) => name),
    additionalProperties: false
  };
}
function validateValue(name, value, rule) {
  if (rule.type === "string") {
    if (typeof value !== "string" || !value.trim() || rule.minLength !== void 0 && value.length < rule.minLength || rule.maxLength !== void 0 && value.length > rule.maxLength || rule.pattern && !new RegExp(rule.pattern).test(value)) {
      throw new Error(`Invalid ${name}: expected a non-empty string matching the endpoint schema.`);
    }
  } else if (rule.type === "array") {
    if (!Array.isArray(value) || value.length < (rule.minItems ?? 1) || value.length > (rule.maxItems ?? 10)) {
      throw new Error(`Invalid ${name}: expected an array of 1 to 10 strings.`);
    }
    if (rule.uniqueItems && new Set(value).size !== value.length) throw new Error(`Invalid ${name}: duplicate items are not allowed.`);
    for (const item of value) validateValue(name, item, rule.items ?? { type: "string" });
  } else if (typeof value !== "number" || !Number.isFinite(value) || rule.type === "integer" && !Number.isInteger(value) || rule.minimum !== void 0 && value < rule.minimum || rule.maximum !== void 0 && value > rule.maximum) {
    throw new Error(`Invalid ${name}: expected ${rule.type} between ${rule.minimum} and ${rule.maximum}.`);
  }
}
function validateResourceParams(resource, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Request body must be a JSON object.");
  const schema = getRequestSchema(resource);
  const source = input;
  const result = {};
  for (const name of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(schema.properties, name)) throw new Error(`Unknown request field: ${name}.`);
  }
  for (const [name, rule] of Object.entries(schema.properties)) {
    const supplied = Object.prototype.hasOwnProperty.call(source, name);
    if (!supplied && schema.required.includes(name)) throw new Error(`Missing required request field: ${name}.`);
    let value = supplied ? source[name] : rule.default;
    if (value === void 0 && !supplied) continue;
    if (typeof value === "string") {
      value = value.trim();
      if (name === "baseCurrency" || name === "countryCode") value = value.toUpperCase();
      if (name === "vsCurrency") value = value.toLowerCase();
      if (name === "doi") value = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    }
    if (Array.isArray(value)) {
      value = value.map((item) => typeof item !== "string" ? item : name === "targets" ? item.trim().toUpperCase() : item.trim().toLowerCase());
    }
    validateValue(name, value, rule);
    result[name] = value;
  }
  return result;
}

// src/server/gatewayHandler.ts
var GATEWAY_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store"
};
var defaults = { verify: verifyPaymentProof, settle: settlePaymentProof, dispatch: dispatchResourceRequest };
var unavailableCodes = /* @__PURE__ */ new Set(["payment_configuration_error", "payment_verification_unavailable", "settlement_pending", "settlement_in_progress"]);
var healthPaths = /* @__PURE__ */ new Set(["/health", "/v1/health", "/api/health", "/api/v1/health", "/.well-known/health"]);
async function handleGatewayRequest(method, pathname, headers, rawBody, origin = process.env.GATEWAY_ORIGIN || "https://relayx402.vercel.app", dependencies = defaults) {
  const respond = (status, body, extra = {}) => ({ status, headers: { ...GATEWAY_HEADERS, ...extra }, body });
  const header = (name) => {
    const values = Object.entries(headers).filter(([key]) => key.toLowerCase() === name.toLowerCase()).map(([, value]) => value);
    if (values.length > 1 || Array.isArray(values[0])) throw new Error(`Duplicate ${name} header.`);
    return values[0];
  };
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "");
  const discovery = ["/.well-known/x402", "/.well-known/x402.json", "/api/well-known/x402"].includes(cleanPath);
  const health = healthPaths.has(cleanPath);
  const matchedResource = RELAY_RESOURCES2.find((candidate) => candidate.path === cleanPath.replace(/^\/api(?=\/v1\/)/, ""));
  const resource = matchedResource ? { ...matchedResource, url: new URL(cleanPath, origin).href } : void 0;
  if (!discovery && !health && !resource) return respond(404, { error: "Not Found", message: "Consult /.well-known/x402 for available endpoints." });
  const allowedMethods = resource ? `${resource.method}, OPTIONS` : "GET, HEAD, OPTIONS";
  if (method === "OPTIONS") return respond(204, null, { "Access-Control-Allow-Methods": allowedMethods, "Access-Control-Max-Age": "600" });
  if (resource ? method !== resource.method : method !== "GET" && method !== "HEAD") {
    return respond(405, { error: "Method Not Allowed" }, { Allow: allowedMethods, "Access-Control-Allow-Methods": allowedMethods });
  }
  if (discovery) return respond(200, method === "HEAD" ? null : getWellKnownManifest(origin), { "Cache-Control": "public, max-age=300" });
  if (health) {
    try {
      const result = await dependencies.dispatch("health", {});
      const operational = result && typeof result === "object" && "status" in result && result.status === "operational";
      return respond(operational ? 200 : 503, method === "HEAD" ? null : result);
    } catch {
      return respond(503, { status: "degraded", error: "Provider health checks unavailable." });
    }
  }
  if (!resource) return respond(404, { error: "Not Found" });
  let params;
  let encodedProof;
  try {
    const length = header("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) {
      return respond(413, { error: "Request Too Large", message: `Maximum request body is ${MAX_REQUEST_BYTES} bytes.` });
    }
    if (header("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return respond(415, { error: "Unsupported Media Type", message: "Send Content-Type: application/json." });
    }
    const serialized = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody === void 0 ? {} : rawBody);
    if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) return respond(413, { error: "Request Too Large" });
    params = validateResourceParams(resource, serialized ? JSON.parse(serialized) : {});
    encodedProof = header("payment-signature");
    if (["authorization", "x-payment-proof", "x-payment", "x-payer-address"].some((name) => header(name) !== void 0)) {
      return respond(400, { error: "Unsupported Payment Format", message: "Use a canonical x402 v2 PAYMENT-SIGNATURE header; legacy proof headers are not accepted." });
    }
  } catch (error) {
    return respond(400, { error: "Bad Request", message: error instanceof SyntaxError ? "Malformed JSON body." : error instanceof Error ? error.message : "Invalid request." });
  }
  const challenge = generate402Challenge(resource, resource.network, origin);
  const challengeHeader = { "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(challenge)).toString("base64") };
  if (!encodedProof) return respond(402, challenge, challengeHeader);
  let proof;
  try {
    if (encodedProof.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedProof)) throw new Error("Invalid payment header.");
    const decoded = Buffer.from(encodedProof, "base64");
    if (decoded.toString("base64") !== encodedProof) throw new Error("Invalid base64 payment header.");
    proof = JSON.parse(decoded.toString("utf8"));
  } catch {
    return respond(400, { error: "Bad Request", message: "PAYMENT-SIGNATURE must be base64-encoded x402 v2 JSON." });
  }
  let verification;
  try {
    verification = await dependencies.verify(proof, resource);
  } catch {
    return respond(503, { error: "Payment Verification Unavailable", message: "Payment verification could not complete. No payment was submitted." });
  }
  if (!verification.valid) {
    const code = verification.errorCode || "invalid_payment";
    if (code === "settlement_pending" || code === "settlement_in_progress") {
      const transaction2 = verification.txHash && /^0x[0-9a-fA-F]{64}$/.test(verification.txHash) ? verification.txHash : "";
      const network2 = `eip155:${resource.chainId}`;
      const paymentResponse2 = { success: false, errorReason: code, transaction: transaction2, network: network2, payer: verification.payer, amount: verification.amount };
      return respond(503, {
        error: "Payment Settlement Failed",
        code,
        transaction: transaction2,
        network: network2,
        message: "Settlement is not confirmed. Reconcile this authorization on-chain before retrying; do not submit a new payment."
      }, { "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse2)).toString("base64") });
    }
    return respond(unavailableCodes.has(code) ? 503 : 402, { error: "Payment Verification Failed", code, message: verification.error || "Payment authorization rejected." }, challengeHeader);
  }
  let data;
  try {
    data = await dependencies.dispatch(resource.id, params);
    const serialized = JSON.stringify(data);
    if (serialized === void 0 || Buffer.byteLength(serialized, "utf8") > 1e6) throw new Error("Invalid provider response size.");
    data = JSON.parse(serialized);
  } catch (cause) {
    console.error("Provider dispatch error in gatewayHandler:", cause);
    return respond(502, { error: "Upstream Provider Error", message: "The provider could not fulfill the request. No payment was submitted." });
  }
  let settlement;
  try {
    settlement = await dependencies.settle(proof, resource);
  } catch {
    return respond(503, { error: "Payment Settlement Failed", code: "settlement_pending", message: "Settlement status is uncertain. Reconcile this authorization on-chain before retrying; do not submit a new payment." });
  }
  const transaction = settlement.txHash && /^0x[0-9a-fA-F]{64}$/.test(settlement.txHash) ? settlement.txHash : "";
  const network = `eip155:${resource.chainId}`;
  const confirmed = settlement.valid && Boolean(transaction) && Boolean(settlement.settledAt) && settlement.amount === resource.amount && settlement.payer.toLowerCase() === verification.payer.toLowerCase() && (!settlement.network || settlement.network === network);
  const paymentResponse = {
    success: confirmed,
    transaction,
    network,
    payer: settlement.payer,
    amount: settlement.amount,
    ...!confirmed ? { errorReason: settlement.errorCode || "settlement_failed" } : {}
  };
  const responseHeader = { "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64") };
  if (!confirmed) {
    const code = settlement.errorCode || "settlement_failed";
    return respond(unavailableCodes.has(code) || transaction ? 503 : 402, {
      error: "Payment Settlement Failed",
      code,
      transaction,
      network,
      message: transaction || unavailableCodes.has(code) ? "Settlement is not confirmed. Reconcile this authorization on-chain before retrying; do not submit a new payment." : settlement.error || "Payment settlement was rejected. No paid data was released."
    }, responseHeader);
  }
  return respond(200, {
    _settlement: {
      protocol: "x402 v2",
      network,
      asset: "USDC",
      cost_usdc: `$${resource.priceUsdc.toFixed(2)}`,
      payer: settlement.payer,
      tx_hash: transaction,
      settled_at: settlement.settledAt
    },
    data
  }, responseHeader);
}

// src/api-handlers/v1-route.ts
async function handler(req, res) {
  try {
    const host = typeof req.headers.host === "string" ? req.headers.host : "relayx402.vercel.app";
    const origin = process.env.GATEWAY_ORIGIN || `https://${host}`;
    const response = await handleGatewayRequest(req.method || "GET", req.url || "/", req.headers, req.body, origin);
    Object.entries(response.headers).forEach(([key, value]) => res.setHeader(key, value));
    if (response.body === null || response.body === void 0 || req.method === "HEAD") return res.status(response.status).end();
    return res.status(response.status).json(response.body);
  } catch {
    Object.entries(GATEWAY_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(500).json({ error: "Gateway Internal Error" });
  }
}
export {
  handler as default
};
