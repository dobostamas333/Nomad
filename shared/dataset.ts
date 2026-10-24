import type { StatId } from './stats';

export type Lang = 'hu' | 'en';
export const LANGS: readonly Lang[] = ['hu', 'en'];

export type Localized = Record<Lang, string>;

export type Continent =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'oceania';

export type SourceId = 'wikidata' | 'worldbank' | 'worldbank-mirror' | 'mledoze' | 'derived';

export interface SourceInfo {
  name: string;
  url: string;
}

export interface StatValue {
  value: number;
  /** Reference year of the figure, when the source provides one. */
  year?: number;
  source: SourceId;
}

export interface CountryRecord {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** ISO 3166-1 alpha-3 */
  iso3: string;
  /** Wikidata item id, e.g. Q28 */
  qid?: string;
  name: Localized;
  continent: Continent;
  /** Representative point used for distance based scoring. */
  latlng: [number, number];
  /**
   * How well known the country is. Wikipedia sitelink count when available,
   * otherwise an estimate. Used for difficulty levels.
   */
  fame: number;
  wiki: Partial<Localized>;
  stats: Partial<Record<StatId, StatValue>>;
}

export interface Dataset {
  generatedAt: string;
  sources: Record<SourceId, SourceInfo>;
  countries: CountryRecord[];
}
