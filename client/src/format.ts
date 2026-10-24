import type { Lang } from '../../shared/dataset';
import { STATS, type StatId } from '../../shared/stats';

/** 🇭🇺 from "HU". */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * Human friendly number: compact words for big numbers ("12,4 millió"),
 * grouped digits for small ones. `precise` keeps more digits for answers.
 */
export function formatNumber(stat: StatId, value: number, lang: Lang, precise = false): string {
  if (stat === 'lifeExpectancy') {
    return value.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (value >= 1e6) {
    return new Intl.NumberFormat(lang, {
      notation: 'compact',
      compactDisplay: 'long',
      maximumSignificantDigits: precise ? 4 : 3,
    }).format(value);
  }
  if (value < 10) return value.toLocaleString(lang, { maximumFractionDigits: precise ? 2 : 1 });
  return value.toLocaleString(lang, precise ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: 3 });
}

// ---- slider ↔ value mapping ---------------------------------------------

export const SLIDER_STEPS = 1000;

export function sliderToValue(stat: StatId, pos: number, range: { min: number; max: number }): number {
  const t = Math.min(1, Math.max(0, pos / SLIDER_STEPS));
  if (STATS[stat].scale === 'log') {
    const lo = Math.log10(range.min);
    const hi = Math.log10(range.max);
    return roundSignificant(10 ** (lo + t * (hi - lo)), 3);
  }
  return Math.round((range.min + t * (range.max - range.min)) * 10) / 10;
}

export function valueToSlider(stat: StatId, value: number, range: { min: number; max: number }): number {
  let t: number;
  if (STATS[stat].scale === 'log') {
    const lo = Math.log10(range.min);
    const hi = Math.log10(range.max);
    t = (Math.log10(Math.max(value, range.min)) - lo) / (hi - lo);
  } else {
    t = (value - range.min) / (range.max - range.min);
  }
  return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS);
}

export function roundSignificant(value: number, digits: number): number {
  if (value === 0) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(value))) - digits + 1);
  const rounded = Math.round(value / magnitude) * magnitude;
  // Avoid floating point noise such as 1.2300000000000002.
  return Number(rounded.toPrecision(digits));
}

/** Parses what people type: "9 500 000", "9,5", "9.500.000", "1e6". */
export function parseTypedNumber(input: string, lang: Lang): number | null {
  let s = input.replace(/[\s  ']/g, '');
  if (!s) return null;
  // Hungarian writes 9,5 and 9.500.000; English the other way around.
  const [decimal, group] = lang === 'hu' ? [',', '.'] : ['.', ','];
  s = s.replaceAll(group, '').replace(decimal, '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Diacritic and case insensitive key for searching country names. */
export function searchKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
