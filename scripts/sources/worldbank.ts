/**
 * Secondary source: World Bank Open Data, used to cross-check Wikidata and to
 * fill gaps. The API is preferred; the GitHub mirror of the same indicators
 * (datasets/population, datasets/gdp) is the offline-friendly fallback.
 */
import type { StatId } from '../../shared/stats';
import { fetchJson, fetchText, parseCsv } from './http';
import { setCandidate, type SourceStats } from './types';

const INDICATORS: Partial<Record<StatId, string>> = {
  population: 'SP.POP.TOTL',
  gdp: 'NY.GDP.MKTP.CD',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  lifeExpectancy: 'SP.DYN.LE00.IN',
};

interface WbRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

export async function loadWorldBank(iso3ToCode: Map<string, string>): Promise<SourceStats> {
  const stats: SourceStats = new Map();
  for (const [stat, indicator] of Object.entries(INDICATORS) as [StatId, string][]) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&mrnev=1`;
    const [, rows] = await fetchJson<[unknown, WbRow[] | null]>(url);
    for (const row of rows ?? []) {
      const code = iso3ToCode.get(row.countryiso3code);
      if (!code || row.value == null) continue;
      setCandidate(stats, code, stat, { value: row.value, year: Number(row.date), source: 'worldbank' });
    }
  }
  return stats;
}

const MIRRORS: Partial<Record<StatId, string>> = {
  population: 'https://raw.githubusercontent.com/datasets/population/main/data/population.csv',
  gdp: 'https://raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv',
};

export async function loadWorldBankMirror(iso3ToCode: Map<string, string>): Promise<SourceStats> {
  const stats: SourceStats = new Map();
  for (const [stat, url] of Object.entries(MIRRORS) as [StatId, string][]) {
    // Columns: Country Name, Country Code, Year, Value
    const [, ...rows] = parseCsv(await fetchText(url));
    const latest = new Map<string, { year: number; value: number }>();
    for (const [, iso3, year, value] of rows) {
      const code = iso3 && iso3ToCode.get(iso3);
      if (!code || !value) continue;
      const y = Number(year);
      if ((latest.get(code)?.year ?? 0) < y) latest.set(code, { year: y, value: Number(value) });
    }
    for (const [code, v] of latest) setCandidate(stats, code, stat, { ...v, source: 'worldbank-mirror' });
  }
  return stats;
}
