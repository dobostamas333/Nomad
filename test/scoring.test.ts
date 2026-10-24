import { describe, expect, it } from 'vitest';
import { distanceKm, MAX_POINTS, scoreCountryGuess, scoreNumericGuess } from '../shared/scoring';

describe('scoreNumericGuess', () => {
  it('gives full points for an exact or near exact guess', () => {
    expect(scoreNumericGuess('population', 9_500_000, 9_500_000)).toBe(MAX_POINTS);
    expect(scoreNumericGuess('population', 9_550_000, 9_500_000)).toBe(MAX_POINTS);
  });

  it('is symmetric in relative error on log scales', () => {
    expect(scoreNumericGuess('area', 200, 100)).toBe(scoreNumericGuess('area', 50, 100));
  });

  it('decays with the error', () => {
    const close = scoreNumericGuess('population', 11_000_000, 10_000_000);
    const twice = scoreNumericGuess('population', 20_000_000, 10_000_000);
    const tenfold = scoreNumericGuess('population', 100_000_000, 10_000_000);
    expect(close).toBeGreaterThan(900);
    expect(twice).toBeGreaterThan(400);
    expect(twice).toBeLessThan(600);
    expect(tenfold).toBeLessThan(10);
  });

  it('uses absolute error for life expectancy', () => {
    expect(scoreNumericGuess('lifeExpectancy', 78, 76)).toBeGreaterThan(850);
    expect(scoreNumericGuess('lifeExpectancy', 60, 80)).toBe(0);
  });

  it('never rewards invalid input', () => {
    expect(scoreNumericGuess('population', Number.NaN, 100)).toBe(0);
    expect(scoreNumericGuess('population', Number.POSITIVE_INFINITY, 100)).toBe(0);
  });
});

describe('country guesses', () => {
  it('measures great-circle distance', () => {
    // Budapest – Vienna is about 215 km.
    expect(distanceKm([47.5, 19.04], [48.21, 16.37])).toBeGreaterThan(200);
    expect(distanceKm([47.5, 19.04], [48.21, 16.37])).toBeLessThan(230);
  });

  it('gives partial points for close misses only', () => {
    expect(scoreCountryGuess(true, 0)).toBe(MAX_POINTS);
    expect(scoreCountryGuess(false, 300)).toBeGreaterThan(400);
    expect(scoreCountryGuess(false, 300)).toBeLessThan(MAX_POINTS);
    expect(scoreCountryGuess(false, 10_000)).toBe(0);
  });
});
