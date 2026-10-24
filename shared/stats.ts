/**
 * Statistic definitions shared by the dataset builder, the server and the client.
 *
 * `scale` decides how a guess is compared with the real value:
 *  - `log`: relative error (being 2x off is equally bad for 1 000 and 1 000 000 000)
 *  - `linear`: absolute error, for narrow ranges like life expectancy
 */
export const STAT_IDS = [
  'population',
  'area',
  'density',
  'gdp',
  'gdpPerCapita',
  'lifeExpectancy',
  'highestPoint',
] as const;

export type StatId = (typeof STAT_IDS)[number];

export interface StatDef {
  id: StatId;
  scale: 'log' | 'linear';
  /** Default slider range; widened at runtime if the dataset contains outliers. */
  min: number;
  max: number;
  /**
   * Scoring width. For `log` it is measured in decades (log10 units),
   * for `linear` in the stat's own unit.
   */
  sigma: number;
}

export const STATS: Record<StatId, StatDef> = {
  population: { id: 'population', scale: 'log', min: 500, max: 2e9, sigma: 0.25 },
  area: { id: 'area', scale: 'log', min: 0.3, max: 2e7, sigma: 0.25 },
  density: { id: 'density', scale: 'log', min: 1, max: 30_000, sigma: 0.25 },
  gdp: { id: 'gdp', scale: 'log', min: 1e7, max: 4e13, sigma: 0.25 },
  gdpPerCapita: { id: 'gdpPerCapita', scale: 'log', min: 100, max: 300_000, sigma: 0.25 },
  lifeExpectancy: { id: 'lifeExpectancy', scale: 'linear', min: 45, max: 90, sigma: 4 },
  highestPoint: { id: 'highestPoint', scale: 'log', min: 1, max: 9_000, sigma: 0.2 },
};

export function isStatId(value: unknown): value is StatId {
  return typeof value === 'string' && (STAT_IDS as readonly string[]).includes(value);
}
