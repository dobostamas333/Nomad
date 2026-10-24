import { STATS, type StatId } from './stats';

export const MAX_POINTS = 1000;
/** Best score for naming the wrong country in reverse mode (when guessing a neighbour). */
export const MAX_WRONG_COUNTRY_POINTS = 600;
const WRONG_COUNTRY_FALLOFF_KM = 1200;

/** Error between guess and answer in the stat's scoring unit (decades or plain units). */
export function guessError(stat: StatId, guess: number, answer: number): number {
  const def = STATS[stat];
  if (def.scale === 'log') {
    const g = Math.max(guess, Number.MIN_VALUE);
    const a = Math.max(answer, Number.MIN_VALUE);
    return Math.abs(Math.log10(g / a));
  }
  return Math.abs(guess - answer);
}

/**
 * Points for a numeric guess: a Gaussian on the error, so near misses still
 * earn most of the points and wild guesses earn nothing.
 */
export function scoreNumericGuess(stat: StatId, guess: number, answer: number): number {
  if (!Number.isFinite(guess) || !Number.isFinite(answer)) return 0;
  const { sigma } = STATS[stat];
  const err = guessError(stat, guess, answer);
  // Within 1% counts as a perfect hit.
  const perfect = STATS[stat].scale === 'log' ? Math.log10(1.01) : sigma / 20;
  if (err <= perfect) return MAX_POINTS;
  return Math.round(MAX_POINTS * Math.exp(-(err * err) / (2 * sigma * sigma)));
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Points for a country guess: full points if right, distance based partial points otherwise. */
export function scoreCountryGuess(correct: boolean, km: number): number {
  if (correct) return MAX_POINTS;
  return Math.round(MAX_WRONG_COUNTRY_POINTS * Math.exp(-km / WRONG_COUNTRY_FALLOFF_KM));
}

export type Accuracy = 'perfect' | 'great' | 'good' | 'meh' | 'miss';

export function accuracyLabel(points: number): Accuracy {
  if (points >= MAX_POINTS) return 'perfect';
  if (points >= 800) return 'great';
  if (points >= 500) return 'good';
  if (points >= 150) return 'meh';
  return 'miss';
}
