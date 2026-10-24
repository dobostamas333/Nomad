/**
 * Primary source: Wikidata, the structured data behind Wikipedia infoboxes.
 * Uses the public SPARQL endpoint; only best-rank statements are used and the
 * most recent one (by "point in time") wins.
 */
import type { StatId } from '../../shared/stats';
import { fetchJson } from './http';
import { setCandidate, type SourceStats, type WikidataCountry } from './types';

export const SPARQL_URL = 'https://query.wikidata.org/sparql';

const USD = 'http://www.wikidata.org/entity/Q4917';

interface SparqlBinding {
  [key: string]: { type: string; value: string } | undefined;
}
interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

async function sparql(query: string): Promise<SparqlBinding[]> {
  const res = await fetchJson<SparqlResponse>(SPARQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  return res.results.bindings;
}

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);
const yearOf = (iso?: string) => (iso ? Number(iso.slice(0, iso.indexOf('-', 1))) : undefined);

/** Resolves ISO codes to Wikidata items, sitelink counts and Wikipedia articles. */
export async function loadWikidataItems(codes: string[]): Promise<Map<string, WikidataCountry>> {
  const values = codes.map((c) => JSON.stringify(c)).join(' ');
  const rows = await sparql(`
    SELECT ?iso2 ?item ?sitelinks ?enwiki ?huwiki WHERE {
      VALUES ?iso2 { ${values} }
      ?item wdt:P297 ?iso2 ; wikibase:sitelinks ?sitelinks .
      FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
      OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?huwiki schema:about ?item ; schema:isPartOf <https://hu.wikipedia.org/> }
    }`);
  const result = new Map<string, WikidataCountry>();
  for (const row of rows) {
    const iso2 = row.iso2?.value;
    const item = row.item?.value;
    if (!iso2 || !item) continue;
    const sitelinks = Number(row.sitelinks?.value ?? 0);
    // Some codes map to more than one item (e.g. a realm and its core country):
    // the better known item wins.
    const prev = result.get(iso2);
    if (prev && prev.sitelinks >= sitelinks) continue;
    result.set(iso2, {
      qid: qidOf(item),
      sitelinks,
      wiki: { en: row.enwiki?.value, hu: row.huwiki?.value },
    });
  }
  return result;
}

interface QuantitySpec {
  stat: StatId;
  property: string;
  /** psn = value normalised to SI units (m², metres), psv = value as entered. */
  valueNs: 'psv' | 'psn';
  unit?: string;
}

const QUANTITIES: QuantitySpec[] = [
  { stat: 'population', property: 'P1082', valueNs: 'psv' },
  { stat: 'area', property: 'P2046', valueNs: 'psn' },
  { stat: 'gdp', property: 'P2131', valueNs: 'psv', unit: USD },
  { stat: 'gdpPerCapita', property: 'P2132', valueNs: 'psv', unit: USD },
  { stat: 'lifeExpectancy', property: 'P2250', valueNs: 'psv' },
];

export async function loadWikidataStats(items: Map<string, WikidataCountry>): Promise<SourceStats> {
  const byQid = new Map([...items].map(([code, w]) => [w.qid, code]));
  const values = [...byQid.keys()].map((q) => `wd:${q}`).join(' ');
  const stats: SourceStats = new Map();

  for (const spec of QUANTITIES) {
    const rows = await sparql(`
      SELECT ?item ?amount ?unit ?time WHERE {
        VALUES ?item { ${values} }
        ?item p:${spec.property} ?st .
        ?st a wikibase:BestRank ; ${spec.valueNs}:${spec.property} ?v .
        ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
        OPTIONAL { ?st pq:P585 ?time }
      }`);
    const best = new Map<string, { value: number; year?: number }>();
    for (const row of rows) {
      const code = byQid.get(qidOf(row.item?.value ?? ''));
      if (!code) continue;
      if (spec.unit && row.unit?.value !== spec.unit) continue;
      let value = Number(row.amount?.value);
      // Normalised area is in square metres.
      if (spec.stat === 'area') value /= 1e6;
      const year = yearOf(row.time?.value);
      const prev = best.get(code);
      if (!prev || (year ?? 0) > (prev.year ?? 0)) best.set(code, { value, year });
    }
    for (const [code, v] of best) setCandidate(stats, code, spec.stat, { ...v, source: 'wikidata' });
  }

  // Highest point: elevation (normalised to metres) of the item in P610.
  const peaks = await sparql(`
    SELECT ?item ?amount WHERE {
      VALUES ?item { ${values} }
      ?item wdt:P610 ?peak .
      ?peak p:P2044 ?st .
      ?st a wikibase:BestRank ; psn:P2044/wikibase:quantityAmount ?amount .
    }`);
  const highest = new Map<string, number>();
  for (const row of peaks) {
    const code = byQid.get(qidOf(row.item?.value ?? ''));
    const value = Number(row.amount?.value);
    if (code && Number.isFinite(value)) highest.set(code, Math.max(value, highest.get(code) ?? -Infinity));
  }
  for (const [code, value] of highest) {
    setCandidate(stats, code, 'highestPoint', { value: Math.round(value), source: 'wikidata' });
  }

  return stats;
}
