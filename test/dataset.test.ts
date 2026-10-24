import { describe, expect, it } from 'vitest';
import dataset from '../data/countries.json';
import type { Dataset } from '../shared/dataset';
import { STATS, type StatId } from '../shared/stats';

const data = dataset as Dataset;

describe('data/countries.json', () => {
  it('covers (almost) every sovereign state', () => {
    expect(data.countries.length).toBeGreaterThanOrEqual(190);
  });

  it('has unique ISO codes and names in both languages', () => {
    expect(new Set(data.countries.map((c) => c.code)).size).toBe(data.countries.length);
    for (const c of data.countries) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.en.length).toBeGreaterThan(1);
      expect(c.name.hu.length).toBeGreaterThan(1);
    }
  });

  it('has the required stats with plausible values and a known source', () => {
    for (const c of data.countries) {
      expect(c.stats.population, c.code).toBeDefined();
      expect(c.stats.area, c.code).toBeDefined();
      for (const [stat, v] of Object.entries(c.stats) as [StatId, { value: number; source: string }][]) {
        const def = STATS[stat];
        expect(v.value, `${c.code} ${stat}`).toBeGreaterThan(0);
        expect(v.value, `${c.code} ${stat}`).toBeLessThan(def.max * 3);
        expect(Object.keys(data.sources)).toContain(v.source);
      }
    }
  });

  it('matches a few well-known facts', () => {
    const byCode = new Map(data.countries.map((c) => [c.code, c]));
    const hu = byCode.get('HU')!;
    expect(hu.name.hu).toBe('Magyarország');
    expect(hu.stats.population!.value).toBeGreaterThan(9_000_000);
    expect(hu.stats.population!.value).toBeLessThan(10_500_000);
    expect(hu.stats.area!.value).toBeGreaterThan(90_000);
    expect(hu.stats.area!.value).toBeLessThan(95_000);
    expect(byCode.get('RU')!.stats.area!.value).toBeGreaterThan(byCode.get('CA')!.stats.area!.value);
  });
});
