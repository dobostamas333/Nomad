/**
 * Base country list: ISO codes, Hungarian/English names, continent and a
 * representative coordinate, from the mledoze/countries open dataset (ODbL).
 */
import type { Continent } from '../../shared/dataset';
import { fetchJson } from './http';
import type { BaseCountry } from './types';

export const MLEDOZE_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

/** UN observers and widely recognised states that are not UN members. */
const EXTRA_STATES = new Set(['VA', 'PS', 'XK', 'TW']);

interface MledozeCountry {
  cca2: string;
  cca3: string;
  unMember?: boolean;
  name: { common: string };
  translations: Record<string, { common: string } | undefined>;
  region: string;
  subregion?: string;
  latlng?: [number, number];
  area?: number;
}

function continentOf(c: MledozeCountry): Continent | null {
  switch (c.region) {
    case 'Africa':
      return 'africa';
    case 'Asia':
      return 'asia';
    case 'Europe':
      return 'europe';
    case 'Oceania':
      return 'oceania';
    case 'Americas':
      return c.subregion === 'South America' ? 'south-america' : 'north-america';
    default:
      return null;
  }
}

export async function loadBaseCountries(): Promise<BaseCountry[]> {
  const raw = await fetchJson<MledozeCountry[]>(MLEDOZE_URL);
  const result: BaseCountry[] = [];
  for (const c of raw) {
    if (!c.unMember && !EXTRA_STATES.has(c.cca2)) continue;
    const continent = continentOf(c);
    if (!continent || !c.latlng) continue;
    result.push({
      code: c.cca2,
      iso3: c.cca3,
      name: { en: c.name.common, hu: c.translations.hun?.common ?? c.name.common },
      continent,
      latlng: c.latlng,
      area: c.area && c.area > 0 ? c.area : undefined,
    });
  }
  return result.sort((a, b) => a.code.localeCompare(b.code));
}
