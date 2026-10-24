import type { Continent, Localized, SourceId } from '../../shared/dataset';
import type { StatId } from '../../shared/stats';

export interface Candidate {
  value: number;
  year?: number;
  source: SourceId;
}

/** Per country (ISO alpha-2) values a single source could provide. */
export type SourceStats = Map<string, Partial<Record<StatId, Candidate>>>;

export interface BaseCountry {
  code: string;
  iso3: string;
  name: Localized;
  continent: Continent;
  latlng: [number, number];
  area?: number;
}

export interface WikidataCountry {
  qid: string;
  sitelinks: number;
  wiki: Partial<Localized>;
}

export function setCandidate(map: SourceStats, code: string, stat: StatId, c: Candidate): void {
  if (!Number.isFinite(c.value) || c.value <= 0) return;
  const entry = map.get(code) ?? {};
  entry[stat] = c;
  map.set(code, entry);
}
