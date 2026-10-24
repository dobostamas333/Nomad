/**
 * Builds data/countries.json, the question bank of the game.
 *
 *   npm run data            # use every source that is reachable
 *   npm run data -- --strict  # fail unless Wikidata and the World Bank API both respond
 *
 * Priority: Wikidata (Wikipedia's structured data) first, cross-checked against
 * the World Bank. When the two disagree wildly the World Bank figure is kept and
 * the conflict is reported, because a quiz must never ask with a wrong answer.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { CountryRecord, Dataset, SourceId, StatValue } from '../shared/dataset';
import { STATS, type StatId } from '../shared/stats';
import { loadBaseCountries } from './sources/mledoze';
import type { Candidate, SourceStats, WikidataCountry } from './sources/types';
import { loadWikidataItems, loadWikidataStats } from './sources/wikidata';
import { loadWorldBank, loadWorldBankMirror } from './sources/worldbank';

const OUT_FILE = fileURLToPath(new URL('../data/countries.json', import.meta.url));

const SOURCES: Dataset['sources'] = {
  wikidata: { name: 'Wikidata / Wikipedia', url: 'https://www.wikidata.org/' },
  worldbank: { name: 'World Bank Open Data', url: 'https://data.worldbank.org/' },
  'worldbank-mirror': {
    name: 'World Bank Open Data (datasets mirror)',
    url: 'https://github.com/datasets/population',
  },
  mledoze: { name: 'mledoze/countries', url: 'https://github.com/mledoze/countries' },
  derived: { name: 'Calculated from the figures above', url: 'https://www.wikidata.org/' },
};

/** Stats whose value changes over time: the newest figure wins. */
const TIME_SERIES = new Set<StatId>(['population', 'gdp', 'gdpPerCapita', 'lifeExpectancy']);
/** Lower index = preferred when years tie or the stat is not a time series. */
const PRIORITY: SourceId[] = ['wikidata', 'worldbank', 'worldbank-mirror', 'mledoze'];
/**
 * Which source settles a disagreement with Wikidata. Area is checked against
 * mledoze's land area: the World Bank's "surface area" can include territorial
 * waters (Canada 15.6 million km², Monaco 75 km²), so it is not used for area.
 */
const DEFAULT_REFERENCE: SourceId[] = ['worldbank', 'worldbank-mirror'];
const REFERENCE: Partial<Record<StatId, SourceId[]>> = { area: ['mledoze'] };
const MAX_RATIO = 1.5;
const MAX_YEARS_DIFF = 5;

const warnings: string[] = [];

function plausible(stat: StatId, value: number): boolean {
  const def = STATS[stat];
  return def.scale === 'log'
    ? value >= def.min / 3 && value <= def.max * 3
    : value >= def.min - 10 && value <= def.max + 10;
}

function disagree(stat: StatId, a: number, b: number): boolean {
  return STATS[stat].scale === 'log'
    ? Math.max(a / b, b / a) > MAX_RATIO
    : Math.abs(a - b) > MAX_YEARS_DIFF;
}

function pick(code: string, stat: StatId, candidates: Candidate[]): Candidate | undefined {
  const valid = candidates.filter((c) => {
    if (plausible(stat, c.value)) return true;
    warnings.push(`${code} ${stat}: dropped implausible ${c.value} from ${c.source}`);
    return false;
  });
  if (!valid.length) return undefined;
  valid.sort((a, b) => {
    if (TIME_SERIES.has(stat) && (b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return PRIORITY.indexOf(a.source) - PRIORITY.indexOf(b.source);
  });
  const chosen = valid[0]!;
  const reference = valid.find((c) => (REFERENCE[stat] ?? DEFAULT_REFERENCE).includes(c.source));
  if (chosen.source === 'wikidata' && reference && disagree(stat, chosen.value, reference.value)) {
    warnings.push(
      `${code} ${stat}: Wikidata ${chosen.value} (${chosen.year ?? '?'}) vs ` +
        `${reference.source} ${reference.value} (${reference.year ?? '?'}), using ${reference.source}`,
    );
    return reference;
  }
  return chosen;
}

async function trySource<T>(name: string, load: () => Promise<T>, required: boolean): Promise<T | null> {
  try {
    const started = Date.now();
    const result = await load();
    console.log(`✓ ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? `${err.message}${err.cause ? ` (${String(err.cause)})` : ''}` : String(err);
    if (required) throw new Error(`${name} failed: ${message}`);
    console.warn(`✗ ${name} unavailable: ${message}`);
    return null;
  }
}

function round(stat: StatId, value: number): number {
  if (stat === 'lifeExpectancy') return Math.round(value * 10) / 10;
  if (stat === 'area' || stat === 'density') return value < 100 ? Math.round(value * 100) / 100 : Math.round(value);
  return Math.round(value);
}

async function main() {
  const strict = process.argv.includes('--strict');

  const base = await trySource('mledoze/countries (base list)', loadBaseCountries, true);
  if (!base) return;
  const codes = base.map((c) => c.code);
  const iso3ToCode = new Map(base.map((c) => [c.iso3, c.code]));
  // The World Bank uses a user-assigned code for Kosovo.
  iso3ToCode.set('XKX', 'XK');

  const items = await trySource('Wikidata items', () => loadWikidataItems(codes), strict);
  const wikidata = items ? await trySource('Wikidata statistics', () => loadWikidataStats(items), strict) : null;
  const worldBank = await trySource('World Bank API', () => loadWorldBank(iso3ToCode), strict);
  // The mirror only matters when the API is down.
  const mirror = worldBank ? null : await trySource('World Bank mirror', () => loadWorldBankMirror(iso3ToCode), false);

  const sources: SourceStats[] = [wikidata, worldBank, mirror].filter((s): s is SourceStats => s !== null);
  const countries: CountryRecord[] = [];

  for (const b of base) {
    const wd: WikidataCountry | undefined = items?.get(b.code);
    const stats: CountryRecord['stats'] = {};

    for (const stat of ['population', 'area', 'gdp', 'gdpPerCapita', 'lifeExpectancy', 'highestPoint'] as StatId[]) {
      const candidates = sources.flatMap((s) => {
        const c = s.get(b.code)?.[stat];
        return c ? [c] : [];
      });
      if (stat === 'area' && b.area) candidates.push({ value: b.area, source: 'mledoze' });
      const chosen = pick(b.code, stat, candidates);
      if (chosen) stats[stat] = { ...chosen, value: round(stat, chosen.value) } satisfies StatValue;
    }

    if (!stats.population || !stats.area) {
      warnings.push(`${b.code}: skipped, population or area missing`);
      continue;
    }
    stats.density = {
      value: round('density', stats.population.value / stats.area.value),
      year: stats.population.year,
      source: 'derived',
    };
    if (!stats.gdpPerCapita && stats.gdp) {
      stats.gdpPerCapita = {
        value: Math.round(stats.gdp.value / stats.population.value),
        year: stats.gdp.year,
        source: 'derived',
      };
    }

    countries.push({
      code: b.code,
      iso3: b.iso3,
      qid: wd?.qid,
      name: b.name,
      continent: b.continent,
      latlng: b.latlng,
      // Without Wikidata, estimate how well known a country is from its size and economy.
      fame:
        wd?.sitelinks ??
        Math.round(10 * Math.log10(stats.population.value) + 10 * Math.log10(stats.gdp?.value ?? 1e8)),
      wiki: wd?.wiki ?? {
        en: `https://en.wikipedia.org/wiki/${encodeURIComponent(b.name.en.replaceAll(' ', '_'))}`,
        hu: `https://hu.wikipedia.org/wiki/${encodeURIComponent(b.name.hu.replaceAll(' ', '_'))}`,
      },
      stats,
    });
  }

  const dataset: Dataset = { generatedAt: new Date().toISOString(), sources: SOURCES, countries };
  await writeFile(OUT_FILE, `${JSON.stringify(dataset, null, 1)}\n`);

  console.log(`\n${countries.length} countries written to data/countries.json`);
  for (const stat of Object.keys(STATS) as StatId[]) {
    const bySource: Record<string, number> = {};
    for (const c of countries) {
      const s = c.stats[stat]?.source;
      if (s) bySource[s] = (bySource[s] ?? 0) + 1;
    }
    console.log(`  ${stat.padEnd(15)} ${JSON.stringify(bySource)}`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warnings:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (!items) console.log('\nNote: Wikidata was unreachable, figures come from the World Bank only.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
