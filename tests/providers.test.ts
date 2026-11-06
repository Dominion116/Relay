import assert from 'node:assert/strict';
import { after, before, describe, test, type TestContext } from 'node:test';
import * as providers from '../src/server/providers';

type FetchCall = { url: URL; signal: AbortSignal };

function mockFetch(t: TestContext, handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.ok(init.signal instanceof AbortSignal, 'every provider fetch must have an abort signal');
    calls.push({ url, signal: init.signal });
    return handler(url, init);
  });
  return calls;
}

function coin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 90_000,
    price_change_percentage_24h: 0, market_cap: 1_800_000_000_000, market_cap_rank: 1,
    total_volume: 30_000_000_000, high_24h: 91_000, low_24h: 89_000,
    circulating_supply: 20_000_000, total_supply: 20_000_000, max_supply: 21_000_000,
    ath: 120_000, ath_date: '2025-10-01T00:00:00.000Z', ...overrides
  };
}

const academicRecord = {
  id: 'https://openalex.org/W123', doi: null, title: 'Measurements of Earth curvature',
  publication_year: 2025, cited_by_count: 0, open_access: { is_oa: false },
  authorships: [{ author: { display_name: 'Example Researcher' } }]
};
const wikidataRecord = { id: 'Q2', label: 'Earth', description: 'Planet in the Solar System' };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

describe('provider adapters (offline)', { concurrency: false }, () => {
  const originalFetch = globalThis.fetch;
  before(() => {
    globalThis.fetch = async () => { throw new Error('Unmocked network access is forbidden in provider tests'); };
  });
  after(() => { globalThis.fetch = originalFetch; });

  test('crypto prices use the requested CoinGecko quote, genuine symbols, and one request', async t => {
    const calls = mockFetch(t, url => {
      assert.equal(url.hostname, 'api.coingecko.com');
      assert.equal(url.pathname, '/api/v3/coins/markets');
      assert.equal(url.searchParams.get('ids'), 'bitcoin');
      assert.equal(url.searchParams.get('per_page'), '1');
      return Response.json([coin({ current_price: url.searchParams.get('vs_currency') === 'eur' ? 83_000 : 90_000 })]);
    });
    const euros = await providers.fetchCryptoPrice(['bitcoin'], 'EUR');
    const dollars = await providers.fetchCryptoPrice(['bitcoin'], 'usd');
    assert.equal(euros.quote_currency, 'EUR');
    assert.equal(euros.prices[0].price, 83_000);
    assert.equal(dollars.quote_currency, 'USD');
    assert.equal(dollars.prices[0].price, 90_000);
    assert.equal(euros.prices[0].symbol, 'BTC');
    assert.equal(euros.prices[0].change_24h_percent, 0);
    assert.equal(euros.prices[0].quote_volume_24h, 30_000_000_000);
    assert.equal(euros.source, 'CoinGecko');
    assert.equal(calls.length, 2);
  });

  test('market data preserves genuine ranks, cap, supplies, ATH, and requested order', async t => {
    mockFetch(t, url => {
      assert.equal(url.searchParams.get('vs_currency'), 'usd');
      assert.equal(url.searchParams.get('ids'), 'ethereum,bitcoin');
      return Response.json([
        coin(),
        coin({ id: 'ethereum', symbol: 'eth', name: 'Ethereum', market_cap_rank: 2, market_cap: 400_000_000_000,
          circulating_supply: 120_000_000, total_supply: 121_000_000, max_supply: null, high_24h: 3200, ath: 4878.26 })
      ]);
    });
    const result = await providers.fetchCryptoMarket(['ethereum', 'bitcoin']);
    assert.equal(result.quote_currency, 'USD');
    assert.deepEqual(result.market_data.map(item => item.id), ['ethereum', 'bitcoin']);
    const ethereum = result.market_data[0];
    assert.equal(ethereum.market_cap_rank, 2);
    assert.equal(ethereum.market_cap, 400_000_000_000);
    assert.equal(ethereum.circulating_supply, 120_000_000);
    assert.equal(ethereum.total_supply, 121_000_000);
    assert.equal(ethereum.max_supply, null);
    assert.equal(ethereum.ath, 4878.26);
    assert.notEqual(ethereum.ath, ethereum.high_24h);
    assert.equal(result.market_data[1].market_cap_rank, 1);
    assert.equal(result.market_data[1].ath_date, '2025-10-01T00:00:00.000Z');
  });

  test('missing assets or missing quote prices never produce partial paid crypto results', async t => {
    let rows = [coin()];
    mockFetch(t, () => Response.json(rows));
    await assert.rejects(providers.fetchCryptoPrice(['bitcoin', 'unknown-asset'], 'eur'), /missing requested.*unknown-asset/);
    await assert.rejects(providers.fetchCryptoMarket(['bitcoin', 'unknown-asset']), /missing requested.*unknown-asset/);
    rows = [coin({ current_price: null })];
    await assert.rejects(providers.fetchCryptoPrice(['bitcoin'], 'eur'), /EUR prices: bitcoin/);
    rows = [];
    await assert.rejects(providers.fetchCryptoMarket(['bitcoin']), /missing requested.*bitcoin/);
  });

  test('unavailable market metrics remain null, not invented zeroes, ranks, or daily highs', async t => {
    mockFetch(t, () => Response.json([{ id: 'bitcoin', current_price: 0, high_24h: 100 }]));
    const price = await providers.fetchCryptoPrice(['bitcoin']);
    const market = await providers.fetchCryptoMarket(['bitcoin']);
    assert.equal(price.prices[0].price, 0);
    assert.equal(price.prices[0].symbol, null);
    assert.equal(price.prices[0].change_24h_percent, null);
    assert.equal(market.market_data[0].market_cap, null);
    assert.equal(market.market_data[0].market_cap_rank, null);
    assert.equal(market.market_data[0].ath, null);
    assert.equal(market.market_data[0].total_supply, null);
  });

  test('CoinGecko failures do not fall back to relabeled Binance quotes', async t => {
    const calls = mockFetch(t, () => new Response('', { status: 429 }));
    await assert.rejects(providers.fetchCryptoPrice(['bitcoin'], 'eur'), /HTTP 429/);
    await assert.rejects(providers.fetchCryptoMarket(['bitcoin']), /HTTP 429/);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.url.hostname === 'api.coingecko.com'));
  });

  test('direct caller bounds reject invalid inputs before any fetch', async t => {
    const calls = mockFetch(t, () => { throw new Error('invalid inputs must not fetch'); });
    const invalidCalls = [
      () => providers.fetchCryptoPrice([]),
      () => providers.fetchCryptoPrice(new Array(1)),
      () => providers.fetchCryptoPrice(['bitcoin', 'BITCOIN']),
      () => providers.fetchCryptoMarket(Array(11).fill('bitcoin')),
      () => providers.fetchCryptoPrice(['a'.repeat(65)]),
      () => providers.fetchCryptoPrice(['bitcoin&ids=ethereum']),
      () => providers.fetchCryptoPrice(['bitcoin'], 'usd&x=1'),
      () => providers.fetchAcademicSearch('topic', NaN),
      () => providers.fetchAcademicSearch('topic', Infinity),
      () => providers.fetchAcademicSearch('topic', 21),
      () => providers.fetchAcademicSearch('topic', 1.5),
      () => providers.fetchAcademicSearch('x'.repeat(1025)),
      () => providers.fetchAcademicWork('not-a-doi'),
      () => providers.fetchAcademicWork('10.1234/' + 'x'.repeat(2048)),
      () => providers.fetchFxRates('USD&to=JPY', ['EUR']),
      () => providers.fetchFxRates('USD', Array(11).fill('EUR')),
      () => providers.fetchFxRates('USD', ['eur', 'EUR']),
      () => providers.fetchFxRates('USD', ['EURO']),
      () => providers.fetchWeather(NaN, 0),
      () => providers.fetchWeather(91, 0),
      () => providers.fetchWeather(0, -181),
      () => providers.fetchWeather('0' as unknown as number, 0),
      () => providers.fetchHolidays('US/../DE'),
      () => providers.fetchHolidays('US', 2101),
      () => providers.fetchHolidays('US', 2026.5),
      () => providers.fetchGeocode(''),
      () => providers.fetchKnowledgeSearch(' '.repeat(4)),
      () => providers.fetchNewsSearch('x'.repeat(1025)),
      () => providers.fetchResearchPack('x'.repeat(1025)),
      () => providers.fetchVerifyClaim('x'.repeat(2049))
    ];
    for (const invoke of invalidCalls) await assert.rejects(invoke());
    assert.equal(calls.length, 0);
  });

  test('OpenAlex missing DOI is null and zero citations/false open access are preserved', async t => {
    const query = 'DNA & RNA? rank=#score';
    mockFetch(t, url => {
      assert.equal(url.searchParams.get('search'), query);
      assert.equal(url.searchParams.get('rank'), null);
      return Response.json({ meta: { count: 1 }, results: [academicRecord] });
    });
    const result = await providers.fetchAcademicSearch(query, 1);
    assert.equal(result.results[0].doi, null);
    assert.equal(result.results[0].id, academicRecord.id);
    assert.equal(result.results[0].cited_by_count, 0);
    assert.equal(result.results[0].is_oa, false);
    assert.deepEqual(result.results[0].authors, ['Example Researcher']);
  });

  test('Crossref academic fallback does not turn arbitrary links into open-access claims', async t => {
    const query = 'DNA & RNA? rows=100';
    const calls = mockFetch(t, url => {
      if (url.hostname === 'api.openalex.org') return new Response('', { status: 503 });
      assert.equal(url.hostname, 'api.crossref.org');
      assert.equal(url.searchParams.get('query'), query);
      assert.equal(url.searchParams.get('rows'), '2');
      return Response.json({ message: { 'total-results': 2, items: [
        { title: ['A paper'], DOI: '10.1234/real', link: [{ URL: 'https://publisher.example/paywall.pdf' }], author: [{ given: 'A', family: 'Researcher' }] },
        { title: ['No DOI'], URL: 'https://publisher.example/record', link: [{ URL: 'https://publisher.example/mining' }] }
      ] } });
    });
    const result = await providers.fetchAcademicSearch(query, 2);
    assert.equal(result.provider, 'Crossref (Live Fallback)');
    assert.equal(result.results[0].doi, 'https://doi.org/10.1234/real');
    assert.equal(result.results[0].is_oa, null);
    assert.equal(result.results[1].doi, null);
    assert.equal(result.results[1].id, 'https://publisher.example/record');
    assert.equal(result.results[1].is_oa, null);
    assert.equal(calls.length, 2);
  });

  test('DOI lookup encodes the entire input suffix and never invents missing metadata', async t => {
    const doi = '10.1234/a?part=x&other=y#fragment';
    mockFetch(t, url => {
      assert.ok(url.pathname.endsWith(encodeURIComponent(doi)));
      assert.equal(url.searchParams.get('other'), null);
      assert.equal(url.hash, '');
      return Response.json(academicRecord);
    });
    const result = await providers.fetchAcademicWork(`https://doi.org/${doi}`);
    assert.equal(result.doi, null);
    assert.equal(result.provider, 'OpenAlex');
  });

  test('invalid OpenAlex work payload falls back to Crossref with unknown OA', async t => {
    mockFetch(t, url => url.hostname === 'api.openalex.org'
      ? Response.json({ error: 'upstream unavailable' })
      : Response.json({ message: { DOI: '10.1234/work', title: ['A retrieved work'], link: [{ URL: 'https://publisher.example/pdf' }] } }));
    const result = await providers.fetchAcademicWork('10.1234/work');
    assert.equal(result.provider, 'Crossref (Live Fallback)');
    assert.equal(result.doi, 'https://doi.org/10.1234/work');
    assert.equal(result.is_oa, null);
  });

  test('empty academic and geocoding searches are valid without unrelated fallback', async t => {
    const calls = mockFetch(t, url => {
      if (url.hostname === 'api.openalex.org') return Response.json({ results: [], meta: { count: 0 } });
      if (url.hostname === 'photon.komoot.io') return Response.json({ features: [] });
      throw new Error('unexpected fallback');
    });
    assert.deepEqual((await providers.fetchAcademicSearch('missing')).results, []);
    assert.deepEqual((await providers.fetchGeocode('missing')).features, []);
    assert.equal(calls.length, 2);
  });

  test('Nominatim fallback preserves zero coordinates and encodes geocoding input', async t => {
    const query = 'Null Island & limit=999';
    const calls = mockFetch(t, url => {
      assert.equal(url.searchParams.get('q'), query);
      assert.equal(url.searchParams.get('limit'), '3');
      if (url.hostname === 'photon.komoot.io') throw new Error('Photon unavailable');
      assert.equal(url.hostname, 'nominatim.openstreetmap.org');
      return Response.json([{ display_name: 'Null Island, Atlantic', lat: '0', lon: '0', osm_type: 'node', address: { country: 'Fixture Country' } }]);
    });
    const result = await providers.fetchGeocode(query);
    assert.equal(result.source, 'Nominatim / OpenStreetMap (Live Fallback)');
    assert.deepEqual(result.features[0].coordinates, { latitude: 0, longitude: 0 });
    assert.equal(result.features[0].country, 'Fixture Country');
    assert.equal(calls.length, 2);
  });

  test('weather keeps zero coordinates and observations and requests only three days', async t => {
    mockFetch(t, url => {
      assert.equal(url.searchParams.get('latitude'), '0');
      assert.equal(url.searchParams.get('longitude'), '0');
      assert.equal(url.searchParams.get('forecast_days'), '3');
      assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
      return Response.json({ latitude: 0, longitude: 0, timezone: 'UTC', elevation: 0,
        current: { temperature_2m: 0, relative_humidity_2m: 0, wind_speed_10m: 0, weather_code: 0 },
        daily: { time: ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'], temperature_2m_max: [0, 1, 2, 3], temperature_2m_min: [-1, 0, 1, 2], weather_code: [0, 1, 2, 3] }
      });
    });
    const result = await providers.fetchWeather(0, 0);
    assert.equal(result.latitude, 0);
    assert.equal(result.longitude, 0);
    assert.equal(result.elevation_m, 0);
    assert.deepEqual(result.current, { temperature_c: 0, humidity_percent: 0, wind_speed_kmh: 0, weather_code: 0 });
    assert.equal(result.forecast_daily.length, 3);
    assert.equal(result.forecast_daily[0].max_temp_c, 0);
  });

  test('FX normalizes encoded currencies and returns only complete requested rates', async t => {
    mockFetch(t, url => {
      assert.equal(url.searchParams.get('from'), 'USD');
      assert.equal(url.searchParams.get('to'), 'EUR,JPY');
      assert.ok(url.search.includes('EUR%2CJPY'));
      return Response.json({ base: 'USD', date: '2026-11-05', rates: { EUR: 0.92, JPY: 150, GBP: 0.8 } });
    });
    const result = await providers.fetchFxRates('usd', ['eur', 'USD', 'jpy']);
    assert.deepEqual(result.rates, { EUR: 0.92, USD: 1, JPY: 150 });
  });

  test('missing FX targets are explicit upstream failures', async t => {
    mockFetch(t, () => Response.json({ base: 'USD', date: '2026-11-05', rates: { EUR: 0.92 } }));
    await assert.rejects(providers.fetchFxRates('USD', ['EUR', 'JPY']), /missing requested rates: JPY/);
  });

  test('the complete 19-entry German holiday fixture includes Christmas and regional applicability', async t => {
    const holidays = Array.from({ length: 17 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`, name: `Fixture holiday ${index + 1}`,
      localName: `Fixture holiday ${index + 1}`, global: false, counties: ['DE-BY'], types: ['Public']
    }));
    holidays.push(
      { date: '2026-12-25', name: 'Christmas Day', localName: 'Christmas Day', global: true, counties: [], types: ['Public'] },
      { date: '2026-12-26', name: 'Second Day of Christmas', localName: 'Second Day of Christmas', global: true, counties: [], types: ['Public'] }
    );
    mockFetch(t, url => {
      assert.equal(url.pathname, '/api/v3/PublicHolidays/2026/DE');
      return Response.json(holidays);
    });
    const result = await providers.fetchHolidays('de', 2026);
    assert.equal(result.holidays.length, 19);
    assert.equal(result.holidays[17].date, '2026-12-25');
    assert.equal(result.holidays[18].date, '2026-12-26');
    assert.deepEqual(result.holidays[0].counties, ['DE-BY']);
  });

  test('omitted holiday year uses the current UTC year at call time', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2033-01-01T00:15:00Z') });
    mockFetch(t, url => {
      assert.equal(url.pathname, '/api/v3/PublicHolidays/2033/US');
      return Response.json([]);
    });
    assert.equal((await providers.fetchHolidays()).year, 2033);
  });

  test('news uses date search and local recency filtering with accurate timestamp provenance', async t => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    const day = 86_400_000;
    t.mock.timers.enable({ apis: ['Date'], now });
    const query = 'OpenAI & tags=comment? #news';
    const calls = mockFetch(t, url => {
      assert.equal(url.hostname, 'hn.algolia.com');
      assert.equal(url.pathname, '/api/v1/search_by_date');
      assert.equal(url.searchParams.get('query'), query);
      assert.equal(url.searchParams.get('tags'), 'story');
      assert.equal(url.searchParams.get('numericFilters'), `created_at_i>=${(now - 30 * day) / 1000},created_at_i<=${now / 1000}`);
      return Response.json({ hits: [
        { objectID: 'old', title: 'Old relevance hit', created_at_i: (now - 31 * day) / 1000 },
        { objectID: 'recent', title: 'Recent submission', url: 'https://www.example.com/article', created_at_i: (now - 2 * day) / 1000, author: 'reader', points: 0, num_comments: 0 },
        { objectID: 'future', title: 'Future timestamp', created_at_i: (now + day) / 1000 },
        { objectID: 'invalid-date', title: 'No date', created_at: 'invalid' },
        { objectID: 'no-url', title: 'HN discussion', url: 'not a url', created_at: new Date(now - day).toISOString() },
        { objectID: 'unsafe&x=1', title: 'Non-web URL', url: 'javascript:alert(1)', created_at_i: (now - 3 * day) / 1000 }
      ] });
    });
    const result = await providers.fetchNewsSearch(query);
    assert.equal(result.total_articles, 3);
    assert.deepEqual(result.articles.map(article => article.title), ['HN discussion', 'Recent submission', 'Non-web URL']);
    assert.equal(result.articles[1].source, 'example.com');
    assert.equal(result.articles[1].points, 0);
    assert.equal(result.articles[1].published_at, null);
    assert.equal(result.articles[1].submitted_at, '2026-11-03T12:00:00.000Z');
    assert.equal(result.articles[1].summary, null);
    assert.equal(result.articles[0].url, 'https://news.ycombinator.com/item?id=no-url');
    assert.equal(new URL(result.articles[2].url).searchParams.get('id'), 'unsafe&x=1');
    assert.match(result.source, /Hacker News/);
    assert.match(result.date_basis, /publication date is unknown/);
    assert.equal(calls.length, 1);
  });

  test('empty or failed news results never become Wikipedia articles', async t => {
    let failing = false;
    const calls = mockFetch(t, () => failing ? new Response('', { status: 503 }) : Response.json({ hits: [] }));
    const result = await providers.fetchNewsSearch('rare topic');
    assert.equal(result.total_articles, 0);
    assert.deepEqual(result.articles, []);
    failing = true;
    await assert.rejects(providers.fetchNewsSearch('rare topic'), /HTTP 503/);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.url.hostname === 'hn.algolia.com'));
  });

  test('search hits cannot support claims or create confidence; actual records remain available', async t => {
    mockFetch(t, url => {
      if (url.hostname === 'www.wikidata.org') return Response.json({ search: [wikidataRecord] });
      if (url.hostname === 'api.openalex.org') return Response.json({ results: [academicRecord], meta: { count: 1 } });
      throw new Error('unexpected provider');
    });
    for (const claim of ['Earth is flat', 'Earth is not flat', 'Water consists of hydrogen and oxygen']) {
      const result = await providers.fetchVerifyClaim(claim);
      assert.equal(result.verdict, 'INSUFFICIENT');
      assert.equal(result.heuristic_metrics.confidence, null);
      assert.equal(result.heuristic_metrics.live_evidence_count, 2);
      assert.equal(result.search_query, claim);
      assert.equal(result.retrieval_complete, true);
      assert.equal(result.verified_at, null);
      assert.match(result.method, /Search matches are not proof/);
      assert.equal(result.evidence_trail[0].results[0].id, 'Q2');
      assert.equal(result.evidence_trail[1].results[0].title, academicRecord.title);
      assert.doesNotMatch(JSON.stringify(result.evidence_trail), /Corroborated/);
    }
  });

  test('claim evidence reports actual fallback providers, partial failures, and total unavailability', async t => {
    let mode = 'fallback';
    mockFetch(t, url => {
      if (url.hostname === 'api.openalex.org' || mode === 'unavailable') return new Response('', { status: 503 });
      if (url.hostname === 'www.wikidata.org') return mode === 'partial'
        ? new Response('', { status: 503 }) : Response.json({ search: [] });
      return Response.json({ message: { items: [{ DOI: '10.1234/evidence', title: ['Retrieved evidence'] }] } });
    });
    const fallback = await providers.fetchVerifyClaim('A claim');
    assert.deepEqual(fallback.heuristic_metrics.live_sources_consulted, ['Wikidata', 'Crossref (Live Fallback)']);
    assert.equal(fallback.evidence_trail[1].provider, 'Crossref (Live Fallback)');
    assert.equal(fallback.evidence_trail[1].results[0].doi, 'https://doi.org/10.1234/evidence');
    mode = 'partial';
    const partial = await providers.fetchVerifyClaim('A claim');
    assert.equal(partial.retrieval_complete, false);
    assert.equal(partial.evidence_trail[0].status, 'Unavailable');
    assert.equal(partial.verdict, 'INSUFFICIENT');
    mode = 'unavailable';
    await assert.rejects(providers.fetchVerifyClaim('A claim'), /retrieval failed across/);
  });

  test('successful empty evidence searches are insufficient and do not imply an outage', async t => {
    mockFetch(t, url => Response.json(url.hostname === 'www.wikidata.org' ? { search: [] } : { results: [], meta: { count: 0 } }));
    const result = await providers.fetchVerifyClaim('Unknown claim');
    assert.equal(result.verdict, 'INSUFFICIENT');
    assert.equal(result.retrieval_complete, true);
    assert.equal(result.heuristic_metrics.live_evidence_count, 0);
    assert.ok(result.evidence_trail.every(entry => entry.status === 'No search results'));
  });

  test('long claims keep the complete claim and disclose bounded search truncation', async t => {
    const claim = 'x'.repeat(2048);
    mockFetch(t, url => {
      assert.equal(url.searchParams.get('search'), claim.slice(0, 1024));
      return Response.json(url.hostname === 'www.wikidata.org' ? { search: [] } : { results: [], meta: { count: 0 } });
    });
    const result = await providers.fetchVerifyClaim(claim);
    assert.equal(result.claim, claim);
    assert.equal(result.search_query.length, 1024);
    assert.equal(result.search_query_truncated, true);
    assert.equal(result.verdict, 'INSUFFICIENT');
  });

  test('research summary says retrieved, preserves evidence, and reports source provenance', async t => {
    const submittedAt = Math.floor(Date.now() / 1000) - 60;
    mockFetch(t, url => {
      if (url.hostname === 'api.openalex.org') return Response.json({ results: [academicRecord], meta: { count: 1 } });
      if (url.hostname === 'www.wikidata.org') return Response.json({ search: [wikidataRecord] });
      if (url.hostname === 'hn.algolia.com') return Response.json({ hits: [{ objectID: '123', title: 'Retrieved submission', created_at_i: submittedAt }] });
      throw new Error('unexpected provider');
    });
    const result = await providers.fetchResearchPack('Earth observations');
    assert.match(result.deterministic_summary, /^Retrieved 1 scholarly records, 1 Wikidata entities, and 1 recent Hacker News submissions/);
    assert.doesNotMatch(result.deterministic_summary, /verified live|real-time news sources/);
    assert.equal(result.evidence.scholarly_citations[0].title, academicRecord.title);
    assert.equal(result.evidence.wikidata_entities[0].id, 'Q2');
    assert.equal(result.evidence.recent_news_and_events[0].title, 'Retrieved submission');
    assert.equal(result.provenance.sources.academic.provider, 'OpenAlex');
    assert.match(result.provenance.sources.news.provider, /Hacker News/);
    assert.ok(!('settlement_network' in result.provenance));
  });

  test('a transport that ignores abort cannot hang a provider past its deadline', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls = mockFetch(t, () => new Promise<Response>(() => {}));
    const pending = providers.fetchWeather(0, 0);
    const rejected = assert.rejects(pending, /timed out after 5000ms/);
    t.mock.timers.tick(5000);
    await rejected;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].signal.aborted, true);
  });

  test('the deadline covers a stalled JSON body after successful response headers', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let readingBody = false;
    const response = new Response('{}');
    t.mock.method(response, 'json', () => {
      readingBody = true;
      return new Promise(() => {});
    });
    const calls = mockFetch(t, () => response);
    const pending = providers.fetchFxRates('USD', ['EUR']);
    const rejected = assert.rejects(pending, /timed out after 5000ms/);
    await flush();
    assert.equal(readingBody, true);
    t.mock.timers.tick(5000);
    await rejected;
    assert.equal(calls[0].signal.aborted, true);
  });

  test('OpenAlex timeout permits a bounded, legitimate Crossref fallback', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls = mockFetch(t, url => url.hostname === 'api.openalex.org'
      ? new Promise<Response>(() => {}) : Response.json({ message: { items: [] } }));
    const pending = providers.fetchAcademicSearch('topic');
    t.mock.timers.tick(5000);
    const result = await pending;
    assert.equal(result.provider, 'Crossref (Live Fallback)');
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.signal.aborted));
  });

  test('failed geocoding primary and fallback each have a finite deadline', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls = mockFetch(t, () => new Promise<Response>(() => {}));
    const rejected = assert.rejects(providers.fetchGeocode('topic'), /nominatim.*timed out/);
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(calls.length, 2);
    t.mock.timers.tick(5000);
    await rejected;
    assert.ok(calls.every(call => call.signal.aborted));
  });

  test('health derives real status, checks current providers, bounds concurrency, and caches single-flight work', async t => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2040-01-01T00:00:00Z') });
    let failing = '';
    let active = 0;
    let peak = 0;
    const calls = mockFetch(t, async url => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (url.hostname === failing) return new Response('', { status: 503 });
      switch (url.hostname) {
        case 'api.coingecko.com': return Response.json({ gecko_says: 'ok' });
        case 'api.openalex.org': return Response.json({ results: [] });
        case 'api.crossref.org': return Response.json({ message: { items: [] } });
        case 'api.frankfurter.app':
          assert.equal(url.searchParams.get('from'), 'USD');
          assert.equal(url.searchParams.get('to'), 'EUR');
          return Response.json(failing === 'fx-payload' ? { base: 'EUR', rates: {} } : { base: 'USD', rates: { EUR: 0.92 } });
        case 'api.open-meteo.com': return Response.json({ current: { temperature_2m: 0 } });
        case 'photon.komoot.io': return Response.json({ features: [] });
        case 'nominatim.openstreetmap.org': return Response.json([]);
        case 'date.nager.at': return Response.json([]);
        case 'www.wikidata.org': return Response.json({ search: [] });
        case 'hn.algolia.com': return Response.json({ hits: [] });
        default: throw new Error('unexpected health provider');
      }
    });
    const [first, concurrent] = await Promise.all([providers.getProvidersHealth(), providers.getProvidersHealth()]);
    assert.equal(first.status, 'operational');
    assert.strictEqual(first, concurrent);
    assert.equal(calls.length, 10);
    assert.equal(peak, 3);
    assert.deepEqual(Object.keys(first.providers).sort(), ['coinGecko', 'crossref', 'frankfurter', 'hackerNews', 'nagerDate', 'nominatim', 'openAlex', 'openMeteo', 'photon', 'wikidata'].sort());
    assert.equal(first.providers.crossref.role, 'fallback');
    assert.equal(first.providers.nominatim.role, 'fallback');
    assert.ok(!('uptime' in first) && !('treasury' in first) && !('network' in first));
    assert.match(first.scope, /not all resource routes/);
    assert.match(first.scope, /payment settlement/);
    assert.equal(first.cacheTtlSeconds, 60);
    assert.strictEqual(await providers.getProvidersHealth(), first);
    assert.equal(calls.length, 10);

    failing = 'api.coingecko.com';
    t.mock.timers.tick(60_001);
    const down = await providers.getProvidersHealth();
    assert.equal(down.status, 'degraded');
    assert.equal(down.providers.coinGecko.status, 'degraded');
    assert.equal(calls.length, 20);
    assert.strictEqual(await providers.getProvidersHealth(), down);
    assert.equal(calls.length, 20);

    failing = 'fx-payload';
    t.mock.timers.tick(60_001);
    const malformed = await providers.getProvidersHealth();
    assert.equal(malformed.status, 'degraded');
    assert.equal(malformed.providers.frankfurter.status, 'degraded');
    assert.equal(malformed.providers.coinGecko.status, 'healthy');

    failing = 'nominatim.openstreetmap.org';
    t.mock.timers.tick(60_001);
    const fallbackDown = await providers.getProvidersHealth();
    assert.equal(fallbackDown.status, 'degraded');
    assert.equal(fallbackDown.providers.nominatim.status, 'degraded');
    assert.ok(peak <= 3);
  });

  test('all health timeouts finish in bounded batches and abort every probe', async t => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2041-01-01T00:00:00Z') });
    const calls = mockFetch(t, () => new Promise<Response>(() => {}));
    const pending = providers.getProvidersHealth();
    for (let batch = 0; batch < 4; batch++) {
      await flush();
      assert.ok(calls.filter(call => !call.signal.aborted).length <= 3);
      t.mock.timers.tick(2500);
    }
    const result = await pending;
    assert.equal(calls.length, 10);
    assert.equal(result.status, 'degraded');
    assert.ok(calls.every(call => call.signal.aborted));
    assert.ok(Object.values(result.providers).every(provider => provider.status === 'degraded' && /timed out/.test(provider.error || '')));
  });
});
