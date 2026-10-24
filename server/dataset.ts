import rawDataset from '../data/countries.json';
import type { CountryRecord, Dataset } from '../shared/dataset';
import type { Difficulty } from '../shared/protocol';
import { STAT_IDS, STATS, type StatId } from '../shared/stats';

export interface GameData {
  dataset: Dataset;
  byCode: Map<string, CountryRecord>;
  /** Countries ordered from most to least known. */
  byFame: CountryRecord[];
  sliderRange: Record<StatId, { min: number; max: number }>;
}

/** How many of the best known countries each difficulty draws from. */
const POOL_SIZE: Record<Difficulty, number> = { easy: 50, medium: 110, hard: Infinity };

/** Rounds outwards to 1, 2 or 5 × 10ⁿ so the slider shows tidy end labels. */
export function niceBound(value: number, direction: 'up' | 'down'): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = direction === 'up' ? [1, 2, 5, 10] : [10, 5, 2, 1];
  const pick = steps.find((s) => (direction === 'up' ? s * magnitude >= value : s * magnitude <= value)) ?? 1;
  return Number((pick * magnitude).toPrecision(12));
}

export function prepareGameData(dataset: Dataset): GameData {
  const byFame = [...dataset.countries].sort((a, b) => b.fame - a.fame);
  const sliderRange = {} as GameData['sliderRange'];
  for (const stat of STAT_IDS) {
    const values = dataset.countries.flatMap((c) => (c.stats[stat] ? [c.stats[stat].value] : []));
    const def = STATS[stat];
    // Keep every real answer reachable on the slider, with a little headroom.
    const min = Math.min(def.min, ...values.map((v) => (def.scale === 'log' ? v / 1.1 : v - 2)));
    const max = Math.max(def.max, ...values.map((v) => (def.scale === 'log' ? v * 1.1 : v + 2)));
    sliderRange[stat] =
      def.scale === 'log' ? { min: niceBound(min, 'down'), max: niceBound(max, 'up') } : { min: Math.floor(min), max: Math.ceil(max) };
  }
  return { dataset, byCode: new Map(dataset.countries.map((c) => [c.code, c])), byFame, sliderRange };
}

export function poolFor(data: GameData, difficulty: Difficulty): CountryRecord[] {
  return data.byFame.slice(0, POOL_SIZE[difficulty]);
}

let cached: GameData | undefined;
export function defaultGameData(): GameData {
  cached ??= prepareGameData(rawDataset as Dataset);
  return cached;
}
