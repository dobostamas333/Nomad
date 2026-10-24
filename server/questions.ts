import type { CountryRecord } from '../shared/dataset';
import type { Clue, GameMode, PublicQuestion, RoomSettings } from '../shared/protocol';
import type { StatId } from '../shared/stats';
import { poolFor, type GameData } from './dataset';

export type Rng = () => number;

/** Small seedable PRNG (mulberry32), so tests can replay a game. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Question {
  public: PublicQuestion;
  country: CountryRecord;
  /** The asked stat in numeric mode. */
  stat?: StatId;
}

/** Population and area are the classics, so they come up a bit more often. */
const NUMERIC_WEIGHTS: Record<StatId, number> = {
  population: 3,
  area: 3,
  density: 1,
  gdp: 1.5,
  gdpPerCapita: 2,
  lifeExpectancy: 2,
  highestPoint: 2,
};

const REVERSE_EXTRA_CLUES: StatId[] = ['gdpPerCapita', 'highestPoint', 'lifeExpectancy', 'density', 'gdp'];

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function weightedPick<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = rng() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

function clueOf(country: CountryRecord, stat: StatId): Clue {
  const v = country.stats[stat]!;
  return { stat, value: v.value, year: v.year };
}

/** Generates the questions of one game: no country is asked twice. */
export function generateQuestions(data: GameData, settings: RoomSettings, rng: Rng = Math.random): Question[] {
  const countries = shuffle(poolFor(data, settings.difficulty), rng).slice(0, settings.rounds);
  const questions: Question[] = [];
  let lastStat: StatId | undefined;

  countries.forEach((country, i) => {
    const kind: Exclude<GameMode, 'mixed'> =
      settings.mode === 'mixed' ? (i % 2 === 0 ? 'numeric' : 'reverse') : settings.mode;

    if (kind === 'numeric') {
      const available = (Object.keys(country.stats) as StatId[]).filter((s) => s !== lastStat);
      const stat = weightedPick(available, (s) => NUMERIC_WEIGHTS[s], rng);
      lastStat = stat;
      questions.push({
        country,
        stat,
        public: {
          kind: 'numeric',
          country: { code: country.code, name: country.name },
          stat,
          slider: data.sliderRange[stat],
        },
      });
    } else {
      const extras = shuffle(
        REVERSE_EXTRA_CLUES.filter((s) => country.stats[s]),
        rng,
      ).slice(0, 2);
      const clues = (['population', 'area', ...extras] as StatId[]).map((s) => clueOf(country, s));
      questions.push({ country, public: { kind: 'reverse', continent: country.continent, clues } });
    }
  });

  // A mixed game should not open with the same kind every time.
  return settings.mode === 'mixed' && rng() < 0.5 ? questions.reverse() : questions;
}
