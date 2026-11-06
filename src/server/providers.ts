/** Live provider adapters. Missing data remains unknown; retrieval is not verification. */

const PROVIDER_TIMEOUT_MS = 5_000;
const HEALTH_TIMEOUT_MS = 2_500;
const HEALTH_CACHE_MS = 60_000;
const MAX_ITEMS = 10;
const NEWS_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

function queryUrl(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const host = new URL(url).hostname;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${host} timed out after ${timeoutMs}ms`));
      controller.abort();
    }, timeoutMs);
  });

  try {
    // Race the whole operation, including the body, even if a transport ignores abort.
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

function boundedText(value: string, name: string, maxLength = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${name} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

function boundedStrings(values: string[], name: string) {
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_ITEMS) {
    throw new Error(`${name} must contain 1-${MAX_ITEMS} items`);
  }
  return Array.from(values, value => boundedText(value, name, 64));
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getOpenAlexMailto(): string | undefined {
  return typeof process !== 'undefined' ? process.env?.OPENALEX_EMAIL : undefined;
}

function getCoinGeckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof process !== 'undefined' && process.env?.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }
  return headers;
}

function openAlexWork(work: any) {
  return {
    id: work.id ?? null,
    doi: work.doi || null,
    title: work.title || 'Untitled Paper',
    publication_year: work.publication_year ?? null,
    authors: (work.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
    journal: work.primary_location?.source?.display_name || work.host_venue?.name || 'N/A',
    cited_by_count: numberOrNull(work.cited_by_count),
    is_oa: typeof work.open_access?.is_oa === 'boolean' ? work.open_access.is_oa : null,
    landing_page_url: work.primary_location?.landing_page_url || work.doi || work.id || null
  };
}

function crossrefWork(item: any) {
  const doi = item.DOI ? `https://doi.org/${item.DOI}` : null;
  return {
    id: doi || item.URL || null,
    doi,
    title: (Array.isArray(item.title) ? item.title[0] : item.title) || 'Untitled Paper',
    publication_year: item.issued?.['date-parts']?.[0]?.[0] ?? null,
    authors: (item.author || []).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
    journal: (Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title']) || 'N/A',
    cited_by_count: numberOrNull(item['is-referenced-by-count']),
    // Crossref links can be paywalled or text-mining links, not evidence of open access.
    is_oa: null,
    landing_page_url: item.URL || doi
  };
}

/** Scholarly search, with a semantically equivalent Crossref fallback. */
export async function fetchAcademicSearch(query: string, limit = 5) {
  query = boundedText(query, 'query');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('limit must be an integer from 1 to 20');
  }

  try {
    const data = await fetchJson(queryUrl('https://api.openalex.org/works', {
      search: query, 'per-page': limit, mailto: getOpenAlexMailto()
    }));
    if (!Array.isArray(data.results)) throw new Error('Invalid OpenAlex search response');
    return {
      query,
      provider: 'OpenAlex',
      total_results: data.meta?.count ?? data.results.length,
      results: data.results.slice(0, limit).map(openAlexWork),
      retrieved_at: new Date().toISOString()
    };
  } catch {
    // OpenAlex failure does not turn a valid Crossref retrieval into a failure.
  }

  const data = await fetchJson(queryUrl('https://api.crossref.org/works', { query, rows: limit }));
  if (!Array.isArray(data.message?.items)) throw new Error('Invalid Crossref search response');
  return {
    query,
    provider: 'Crossref (Live Fallback)',
    total_results: data.message['total-results'] ?? data.message.items.length,
    results: data.message.items.slice(0, limit).map(crossrefWork),
    retrieved_at: new Date().toISOString()
  };
}

/** DOI lookup. A provider record without a DOI keeps a null DOI. */
export async function fetchAcademicWork(doi: string) {
  const cleanDoi = boundedText(doi, 'doi', 2048).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\/\S+$/.test(cleanDoi)) throw new Error('Invalid DOI');

  try {
    const work = await fetchJson(queryUrl(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`, {
      mailto: getOpenAlexMailto()
    }));
    if (!work.id) throw new Error('Invalid OpenAlex work response');
    return { ...openAlexWork(work), provider: 'OpenAlex', retrieved_at: new Date().toISOString() };
  } catch {
    // Crossref resolves the same requested DOI.
  }

  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
  if (!data.message || (!data.message.DOI && !data.message.title)) throw new Error('Invalid Crossref work response');
  return { ...crossrefWork(data.message), provider: 'Crossref (Live Fallback)', retrieved_at: new Date().toISOString() };
}

async function coinGeckoMarkets(assets: string[], vsCurrency: string) {
  const ids = boundedStrings(assets, 'assets').map(asset => asset.toLowerCase());
  if (ids.some(id => !/^[a-z0-9][a-z0-9-]*$/.test(id))) throw new Error('assets must be CoinGecko IDs');
  if (new Set(ids).size !== ids.length) throw new Error('assets must not contain duplicates');
  const currency = boundedText(vsCurrency, 'vsCurrency', 5).toLowerCase();
  if (!/^[a-z]{3,5}$/.test(currency)) throw new Error('Invalid quote currency');

  // One bounded request gives genuine symbols and quote-denominated market fields.
  const data = await fetchJson(queryUrl('https://api.coingecko.com/api/v3/coins/markets', {
    vs_currency: currency, ids: ids.join(','), per_page: ids.length, page: 1, sparkline: 'false'
  }), { headers: getCoinGeckoHeaders() });
  if (!Array.isArray(data)) throw new Error('Invalid CoinGecko market response');
  const byId = new Map<string, any>(data.map(coin => [coin.id, coin]));
  const missing = ids.filter(id => !byId.has(id) || numberOrNull(byId.get(id).current_price) === null);
  if (missing.length) throw new Error(`CoinGecko missing requested assets or ${currency.toUpperCase()} prices: ${missing.join(', ')}`);
  return { currency, coins: ids.map(id => byId.get(id)) };
}

/** Requested CoinGecko quote currency, never relabeled USDT prices. */
export async function fetchCryptoPrice(assets: string[] = ['ethereum', 'bitcoin'], vsCurrency = 'usd') {
  const { currency, coins } = await coinGeckoMarkets(assets, vsCurrency);
  return {
    quote_currency: currency.toUpperCase(),
    prices: coins.map(coin => ({
      asset: coin.id,
      symbol: coin.symbol?.toUpperCase() ?? null,
      price: coin.current_price,
      change_24h_percent: numberOrNull(coin.price_change_percentage_24h),
      high_24h: numberOrNull(coin.high_24h),
      low_24h: numberOrNull(coin.low_24h),
      quote_volume_24h: numberOrNull(coin.total_volume)
    })),
    source: 'CoinGecko',
    retrieved_at: new Date().toISOString()
  };
}

/** USD market data as reported by CoinGecko; unavailable metrics stay null. */
export async function fetchCryptoMarket(assets: string[] = ['ethereum', 'bitcoin']) {
  const { coins } = await coinGeckoMarkets(assets, 'usd');
  return {
    quote_currency: 'USD',
    market_data: coins.map(coin => ({
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
    source: 'CoinGecko',
    retrieved_at: new Date().toISOString()
  };
}

/** European Central Bank reference rates via Frankfurter. */
export async function fetchFxRates(baseCurrency = 'USD', targets: string[] = ['EUR', 'GBP', 'JPY', 'CAD']) {
  const base = boundedText(baseCurrency, 'baseCurrency', 3).toUpperCase();
  const currencies = boundedStrings(targets, 'targets').map(target => target.toUpperCase());
  if (![base, ...currencies].every(currency => /^[A-Z]{3}$/.test(currency))) throw new Error('Invalid FX currency code');
  if (new Set(currencies).size !== currencies.length) throw new Error('targets must not contain duplicates');
  const otherCurrencies = currencies.filter(currency => currency !== base);
  const data = await fetchJson(queryUrl('https://api.frankfurter.app/latest', {
    from: base, to: otherCurrencies.length ? otherCurrencies.join(',') : undefined
  }));
  if (data.base !== base || !data.rates || typeof data.date !== 'string') throw new Error('Invalid Frankfurter response');
  const missing = otherCurrencies.filter(currency => !(typeof data.rates[currency] === 'number' && Number.isFinite(data.rates[currency]) && data.rates[currency] > 0));
  if (missing.length) throw new Error(`Frankfurter missing requested rates: ${missing.join(', ')}`);
  return {
    base: data.base,
    date: data.date,
    rates: Object.fromEntries(currencies.map(currency => [currency, currency === base ? 1 : data.rates[currency]])),
    source: 'European Central Bank (Frankfurter)',
    retrieved_at: new Date().toISOString()
  };
}

/** Current weather and a three-day forecast from Open-Meteo. */
export async function fetchWeather(latitude = 37.7749, longitude = -122.4194) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Invalid weather coordinates');
  const data = await fetchJson(queryUrl('https://api.open-meteo.com/v1/forecast', {
    latitude, longitude, current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min', timezone: 'auto',
    forecast_days: 3, temperature_unit: 'celsius', wind_speed_unit: 'kmh'
  }));
  if (!data.current || !Array.isArray(data.daily?.time)) throw new Error('Invalid Open-Meteo response');
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
    forecast_daily: data.daily.time.slice(0, 3).map((date: string, i: number) => ({
      date,
      max_temp_c: numberOrNull(data.daily.temperature_2m_max?.[i]),
      min_temp_c: numberOrNull(data.daily.temperature_2m_min?.[i]),
      weather_code: numberOrNull(data.daily.weather_code?.[i])
    })),
    source: 'Open-Meteo',
    retrieved_at: new Date().toISOString()
  };
}

/** Forward geocoding via Photon, with the equivalent Nominatim fallback. */
export async function fetchGeocode(query: string) {
  query = boundedText(query, 'query');
  try {
    const data = await fetchJson(queryUrl('https://photon.komoot.io/api/', { q: query, limit: 3 }));
    if (!Array.isArray(data.features)) throw new Error('Invalid Photon response');
    return {
      query,
      features: data.features.slice(0, 3).map((f: any) => ({
        name: f.properties.name,
        country: f.properties.country,
        city: f.properties.city || f.properties.name,
        state: f.properties.state,
        coordinates: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
        osm_type: f.properties.osm_type
      })),
      source: 'Photon / OpenStreetMap',
      retrieved_at: new Date().toISOString()
    };
  } catch {
    // Nominatim also provides forward geocoding, not a different result category.
  }

  const data = await fetchJson(queryUrl('https://nominatim.openstreetmap.org/search', {
    q: query, format: 'json', limit: 3, addressdetails: 1
  }), { headers: { 'User-Agent': 'Relay-x402-Gateway/1.0' } });
  if (!Array.isArray(data)) throw new Error('Invalid Nominatim response');
  return {
    query,
    features: data.slice(0, 3).map((item: any) => ({
      name: item.name || item.display_name?.split(',')[0] || null,
      country: item.address?.country ?? null,
      city: item.address?.city || item.address?.town || item.address?.village || null,
      state: item.address?.state ?? null,
      coordinates: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
      osm_type: item.osm_type ?? null
    })),
    source: 'Nominatim / OpenStreetMap (Live Fallback)',
    retrieved_at: new Date().toISOString()
  };
}

/** Full public holiday schedule, including regional holidays. */
export async function fetchHolidays(countryCode = 'US', year = new Date().getUTCFullYear()) {
  const country = boundedText(countryCode, 'countryCode', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Invalid country code');
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('year must be an integer from 1900 to 2100');
  const data = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${encodeURIComponent(year)}/${encodeURIComponent(country)}`);
  if (!Array.isArray(data)) throw new Error('Invalid Nager.Date response');
  return {
    country_code: country,
    year,
    holidays: data.map((holiday: any) => ({
      date: holiday.date,
      local_name: holiday.localName,
      name: holiday.name,
      global: holiday.global,
      counties: holiday.counties ?? null,
      types: holiday.types
    })),
    source: 'Nager.Date',
    retrieved_at: new Date().toISOString()
  };
}

/** Wikidata entity search, not an assessment of assertions about those entities. */
export async function fetchKnowledgeSearch(query: string) {
  query = boundedText(query, 'query');
  const data = await fetchJson(queryUrl('https://www.wikidata.org/w/api.php', {
    action: 'wbsearchentities', search: query, language: 'en', format: 'json', origin: '*', limit: 5
  }));
  if (!Array.isArray(data.search)) throw new Error('Invalid Wikidata response');
  return {
    query,
    entities: data.search.slice(0, 5).map((entity: any) => ({
      id: entity.id,
      label: entity.label,
      description: entity.description || 'No description provided',
      concept_uri: entity.concepturi || `https://www.wikidata.org/entity/${encodeURIComponent(entity.id)}`,
      url: entity.url ? (entity.url.startsWith('http') ? entity.url : `https:${entity.url}`) : `https://www.wikidata.org/wiki/${encodeURIComponent(entity.id)}`
    })),
    source: 'Wikidata',
    retrieved_at: new Date().toISOString()
  };
}

/** Recent Hacker News submissions. Submission time is not article publication time. */
export async function fetchNewsSearch(query: string) {
  query = boundedText(query, 'query');
  const now = Date.now();
  const cutoff = now - NEWS_WINDOW_MS;
  const data = await fetchJson(queryUrl('https://hn.algolia.com/api/v1/search_by_date', {
    query, tags: 'story', hitsPerPage: 5,
    numericFilters: `created_at_i>=${Math.ceil(cutoff / 1000)},created_at_i<=${Math.floor(now / 1000)}`
  }));
  if (!Array.isArray(data.hits)) throw new Error('Invalid Hacker News Algolia response');
  const articles = (data.hits as any[]).flatMap((hit: any) => {
    const submittedAt = typeof hit.created_at_i === 'number' ? hit.created_at_i * 1000 : Date.parse(hit.created_at);
    if (!Number.isFinite(submittedAt) || submittedAt < cutoff || submittedAt > now) return [];
    const discussionUrl = queryUrl('https://news.ycombinator.com/item', { id: hit.objectID });
    let articleUrl: URL | undefined;
    try {
      const url = new URL(hit.url);
      if (url.protocol === 'https:' || url.protocol === 'http:') articleUrl = url;
    } catch {
      // A missing or malformed external URL does not invalidate the HN submission.
    }
    return [{
      title: hit.title,
      source: articleUrl?.hostname.replace(/^www\./, '') || 'news.ycombinator.com',
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
    source: 'Hacker News submissions (Algolia)',
    date_basis: 'Hacker News submission time; original article publication date is unknown',
    window_start: new Date(cutoff).toISOString(),
    window_end: new Date(now).toISOString(),
    retrieved_at: new Date().toISOString()
  };
}

/** Fixed three-source retrieval; no claim verification or synthetic summary. */
export async function fetchResearchPack(topic: string) {
  topic = boundedText(topic, 'topic');
  const [academic, knowledge, news] = await Promise.all([
    fetchAcademicSearch(topic, 3), fetchKnowledgeSearch(topic), fetchNewsSearch(topic)
  ]);
  return {
    topic,
    provenance: {
      generated_by: 'Relay Deterministic Multi-Source Aggregator',
      is_synthetic_mock: false,
      sources: {
        academic: { provider: academic.provider, retrieved_at: academic.retrieved_at },
        knowledge: { provider: knowledge.source, retrieved_at: knowledge.retrieved_at },
        news: { provider: news.source, retrieved_at: news.retrieved_at, window_start: news.window_start, window_end: news.window_end, date_basis: news.date_basis }
      },
      timestamp: new Date().toISOString()
    },
    evidence: {
      scholarly_citations: academic.results,
      wikidata_entities: knowledge.entities,
      recent_news_and_events: news.articles
    },
    deterministic_summary: `Retrieved ${academic.results.length} scholarly records, ${knowledge.entities.length} Wikidata entities, and ${news.articles.length} recent Hacker News submissions for topic "${topic}". No claim verification or full-text assessment was performed.`
  };
}

/** Search evidence cannot establish whether a claim is true or false. */
export async function fetchVerifyClaim(claim: string) {
  claim = boundedText(claim, 'claim', 2048);
  const lower = claim.toLowerCase();
  const keywords = lower.replace(/[^a-z0-9 ]/g, '').split(/\s+/)
    .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'been', 'which'].includes(word));
  const searchQuery = claim.slice(0, 1024);
  const [wikiCheck, academicCheck] = await Promise.allSettled([
    fetchKnowledgeSearch(searchQuery), fetchAcademicSearch(searchQuery, 2)
  ]);
  if (wikiCheck.status === 'rejected' && academicCheck.status === 'rejected') {
    throw new Error('Claim evidence retrieval failed across Wikidata and academic providers');
  }
  const wiki = wikiCheck.status === 'fulfilled' ? wikiCheck.value : null;
  const academic = academicCheck.status === 'fulfilled' ? academicCheck.value : null;
  const evidenceTrail = [
    {
      provider: wiki?.source ?? 'Wikidata',
      matches_found: wiki?.entities.length ?? 0,
      status: wiki ? (wiki.entities.length ? 'Retrieved search results' : 'No search results') : 'Unavailable',
      results: wiki?.entities ?? [],
      retrieved_at: wiki?.retrieved_at ?? null
    },
    {
      provider: academic?.provider ?? 'OpenAlex / Crossref',
      matches_found: academic?.results.length ?? 0,
      status: academic ? (academic.results.length ? 'Retrieved search results' : 'No search results') : 'Unavailable',
      results: academic?.results ?? [],
      retrieved_at: academic?.retrieved_at ?? null
    }
  ];
  return {
    claim,
    verdict: 'INSUFFICIENT' as const,
    method: 'Search-result retrieval only; no entailment, contradiction, source-quality, or full-text assessment. Search matches are not proof and confidence is not estimated.',
    search_query: searchQuery,
    search_query_truncated: searchQuery.length !== claim.length,
    retrieval_complete: Boolean(wiki && academic),
    heuristic_metrics: {
      confidence: null,
      lexical_terms_extracted: keywords,
      negation_cue_detected: /\b(not|never|fake|false|refuses|cannot|untrue|denies|debunked)\b/.test(lower),
      live_sources_consulted: [wiki?.source, academic?.provider].filter((source): source is string => Boolean(source)),
      live_evidence_count: evidenceTrail.reduce((count, entry) => count + entry.matches_found, 0)
    },
    evidence_trail: evidenceTrail,
    verified_at: null,
    retrieved_at: new Date().toISOString()
  };
}

async function checkProviders() {
  const probes: { name: string; url: string; init?: RequestInit; role: 'primary' | 'fallback'; valid: (data: any) => boolean }[] = [
    { name: 'coinGecko', url: 'https://api.coingecko.com/api/v3/ping', init: { headers: getCoinGeckoHeaders() }, role: 'primary', valid: data => typeof data?.gecko_says === 'string' },
    { name: 'openAlex', url: queryUrl('https://api.openalex.org/works', { 'per-page': 1, select: 'id', mailto: getOpenAlexMailto() }), role: 'primary', valid: data => Array.isArray(data?.results) },
    { name: 'crossref', url: queryUrl('https://api.crossref.org/works', { rows: 1, select: 'DOI' }), role: 'fallback', valid: data => Array.isArray(data?.message?.items) },
    { name: 'frankfurter', url: queryUrl('https://api.frankfurter.app/latest', { from: 'USD', to: 'EUR' }), role: 'primary', valid: data => data?.base === 'USD' && numberOrNull(data?.rates?.EUR) !== null && data.rates.EUR > 0 },
    { name: 'openMeteo', url: queryUrl('https://api.open-meteo.com/v1/forecast', { latitude: 0, longitude: 0, current: 'temperature_2m', forecast_days: 1 }), role: 'primary', valid: data => numberOrNull(data?.current?.temperature_2m) !== null },
    { name: 'photon', url: queryUrl('https://photon.komoot.io/api/', { q: 'Berlin', limit: 1 }), role: 'primary', valid: data => Array.isArray(data?.features) },
    { name: 'nominatim', url: queryUrl('https://nominatim.openstreetmap.org/search', { q: 'Berlin', format: 'json', limit: 1 }), init: { headers: { 'User-Agent': 'Relay-x402-Gateway/1.0' } }, role: 'fallback', valid: data => Array.isArray(data) },
    { name: 'nagerDate', url: `https://date.nager.at/api/v3/PublicHolidays/${new Date().getUTCFullYear()}/DE`, role: 'primary', valid: data => Array.isArray(data) },
    { name: 'wikidata', url: queryUrl('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: 'Berlin', language: 'en', format: 'json', limit: 1 }), role: 'primary', valid: data => Array.isArray(data?.search) },
    { name: 'hackerNews', url: queryUrl('https://hn.algolia.com/api/v1/search_by_date', { tags: 'story', hitsPerPage: 1 }), role: 'primary', valid: data => Array.isArray(data?.hits) }
  ];
  const checks: Record<string, { status: 'healthy' | 'degraded'; latencyMs: number; role: 'primary' | 'fallback'; error?: string }> = {};
  let next = 0;
  const worker = async () => {
    while (next < probes.length) {
      const probe = probes[next++];
      const started = performance.now();
      try {
        const data = await fetchJson(probe.url, probe.init, HEALTH_TIMEOUT_MS);
        if (!probe.valid(data)) throw new Error('Unexpected provider probe response');
        checks[probe.name] = { status: 'healthy', latencyMs: Math.round(performance.now() - started), role: probe.role };
      } catch (error) {
        checks[probe.name] = {
          status: 'degraded', latencyMs: Math.round(performance.now() - started), role: probe.role,
          error: error instanceof Error ? error.message : 'Provider probe failed'
        };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return {
    status: Object.values(checks).every(check => check.status === 'healthy') ? 'operational' as const : 'degraded' as const,
    gateway: 'Relay x402 Gateway',
    scope: 'One lightweight availability probe per listed primary/fallback provider; not all resource routes, data correctness, payment settlement, blockchain health, or gateway uptime.',
    providers: checks,
    checkedAt: new Date().toISOString(),
    cacheTtlSeconds: HEALTH_CACHE_MS / 1000
  };
}

let healthCache: { value: Awaited<ReturnType<typeof checkProviders>>; expiresAt: number } | undefined;
let healthInFlight: Promise<Awaited<ReturnType<typeof checkProviders>>> | undefined;

/** Process-local cache and single-flight probing bound the load of the free health route. */
export async function getProvidersHealth() {
  if (healthCache && Date.now() < healthCache.expiresAt) return healthCache.value;
  if (!healthInFlight) {
    healthInFlight = checkProviders().then(value => {
      healthCache = { value, expiresAt: Date.now() + HEALTH_CACHE_MS };
      return value;
    }).finally(() => { healthInFlight = undefined; });
  }
  return healthInFlight;
}
