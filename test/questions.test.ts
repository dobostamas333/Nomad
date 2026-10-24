import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/protocol';
import { defaultGameData, poolFor } from '../server/dataset';
import { generateQuestions, seededRng } from '../server/questions';

const data = defaultGameData();

describe('generateQuestions', () => {
  it('creates the requested number of rounds without repeating a country', () => {
    const qs = generateQuestions(data, { ...DEFAULT_SETTINGS, rounds: 15 }, seededRng(1));
    expect(qs).toHaveLength(15);
    expect(new Set(qs.map((q) => q.country.code)).size).toBe(15);
  });

  it('alternates kinds in mixed mode', () => {
    const qs = generateQuestions(data, { ...DEFAULT_SETTINGS, mode: 'mixed', rounds: 10 }, seededRng(2));
    const kinds = qs.map((q) => q.public.kind);
    expect(kinds.filter((k) => k === 'numeric')).toHaveLength(5);
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
  });

  it('keeps answers out of the public question', () => {
    for (const q of generateQuestions(data, { ...DEFAULT_SETTINGS, mode: 'numeric' }, seededRng(3))) {
      expect(q.public.kind).toBe('numeric');
      expect(JSON.stringify(q.public)).not.toContain(String(q.country.stats[q.stat!]!.value));
    }
    for (const q of generateQuestions(data, { ...DEFAULT_SETTINGS, mode: 'reverse' }, seededRng(4))) {
      const json = JSON.stringify(q.public);
      expect(json).not.toContain(q.country.code);
      expect(json).not.toContain(q.country.name.en);
    }
  });

  it('draws easy questions from well-known countries', () => {
    const easy = new Set(poolFor(data, 'easy').map((c) => c.code));
    for (const q of generateQuestions(data, { ...DEFAULT_SETTINGS, difficulty: 'easy', rounds: 15 }, seededRng(5))) {
      expect(easy.has(q.country.code)).toBe(true);
    }
  });

  it('puts every real answer inside the slider range', () => {
    for (const c of data.dataset.countries) {
      for (const [stat, v] of Object.entries(c.stats)) {
        const range = data.sliderRange[stat as keyof typeof data.sliderRange];
        expect(v.value).toBeGreaterThanOrEqual(range.min);
        expect(v.value).toBeLessThanOrEqual(range.max);
      }
    }
  });
});
