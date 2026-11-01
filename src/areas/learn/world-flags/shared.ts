// World Flags: shared constants, helpers, and types for the Explore /
// Learn-path / Certificates sub-tabs. Ported from the legacy family-hub
// World Flags components, adapted to the new design system.

import { COUNTRIES, getCountriesByContinent, type Country } from './countries';

// ─── Flag images (Flagpedia / flagcdn CDN) ──────────────────────────────────
//
// flagcdn serves flat PNG flags keyed by lowercase ISO 3166-1 alpha-2 code.
// Sizes: w40 (thumbnail), w80 (small), w320 (card). Components fall back to
// the unicode emoji from countries.ts when the image fails to load.

export type FlagSize = 'w40' | 'w80' | 'w320';

export function flagUrl(code: string, size: FlagSize = 'w320'): string {
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

// ─── Continent visual constants ──────────────────────────────────────────────

/** Tailwind gradient `from-…to-…` classes per continent (cards / headers). */
export const CONTINENT_GRADIENT: Record<string, string> = {
  All: 'from-gray-500 to-gray-600',
  Africa: 'from-amber-500 to-orange-500',
  Asia: 'from-red-500 to-pink-500',
  Europe: 'from-blue-500 to-indigo-500',
  'North America': 'from-green-500 to-emerald-500',
  'South America': 'from-teal-500 to-cyan-500',
  Oceania: 'from-purple-500 to-violet-500',
};

/** Solid background per continent (filter chips when active). */
export const CONTINENT_SOLID: Record<string, string> = {
  All: 'bg-gray-700',
  Africa: 'bg-amber-500',
  Asia: 'bg-red-500',
  Europe: 'bg-blue-600',
  'North America': 'bg-green-600',
  'South America': 'bg-teal-600',
  Oceania: 'bg-purple-600',
};

export const CONTINENT_EMOJI: Record<string, string> = {
  All: '🌍',
  Africa: '🌍',
  Asia: '🌏',
  Europe: '🌍',
  'North America': '🌎',
  'South America': '🌎',
  Oceania: '🌏',
};

/** Kebab id for test ids and keys, e.g. "North America" → "north-america". */
export function continentId(continent: string): string {
  return continent.toLowerCase().replace(/\s+/g, '-');
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

export function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ─── Learn path: chunks of 5 + per-set quiz ─────────────────────────────────

export const CHUNK_SIZE = 5;

export function getChunksForContinent(continent: string): Country[][] {
  const countries = getCountriesByContinent(continent);
  const chunks: Country[][] = [];
  for (let i = 0; i < countries.length; i += CHUNK_SIZE) {
    chunks.push(countries.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

export interface LearnQuizQuestion {
  country: Country;
  choices: string[];
  answer: string;
}

/**
 * Builds one multiple-choice question per country in the set. Distractors
 * prefer same-continent countries, falling back to the whole world when the
 * continent is too small.
 */
export function generateLearnQuiz(
  chunk: readonly Country[],
  continentCountries: readonly Country[],
): LearnQuizQuestion[] {
  let distractorPool = continentCountries.filter((c) => !chunk.some((ch) => ch.code === c.code));
  if (distractorPool.length < 3) {
    distractorPool = COUNTRIES.filter((c) => !chunk.some((ch) => ch.code === c.code));
  }
  return shuffle(chunk).map((country) => {
    const distractors = shuffle(distractorPool.filter((c) => c.code !== country.code))
      .slice(0, 3)
      .map((c) => c.name);
    return {
      country,
      choices: shuffle([country.name, ...distractors]),
      answer: country.name,
    };
  });
}

// ─── Timed quiz (World Explorer) ─────────────────────────────────────────────

export const WORLD_QUIZ_DURATION = 60; // seconds

export type TimedQuestionType = 'flag-to-name' | 'name-to-capital' | 'funfact-to-name';

export interface TimedQuizQuestion {
  type: TimedQuestionType;
  country: Country;
  choices: string[];
  answer: string;
}

/**
 * Replaces the country name (and possessive) in fun-fact text so it can't give
 * the answer away. Uses word boundaries so a short name isn't redacted inside a
 * longer one (e.g. "Niger" must not match inside "Nigeria").
 */
export function redactCountryName(text: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = text.replace(new RegExp(`\\b${escaped}\\b's`, 'gi'), "This country's");
  result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'This country');
  return result;
}

export function generateTimedQuestion(continent?: string): TimedQuizQuestion {
  const pool = continent && continent !== 'All' ? getCountriesByContinent(continent) : COUNTRIES;
  const country = pickRandom(pool);
  const type = pickRandom<TimedQuestionType>([
    'flag-to-name',
    'name-to-capital',
    'funfact-to-name',
  ]);
  const answer = type === 'name-to-capital' ? country.capital : country.name;

  const sameContinent = getCountriesByContinent(country.continent).filter(
    (c) => c.code !== country.code,
  );
  const otherCountries = COUNTRIES.filter(
    (c) => c.code !== country.code && c.continent !== country.continent,
  );
  const distractorPool = [...shuffle(sameContinent), ...shuffle(otherCountries)];

  const distractors: string[] = [];
  const used = new Set([answer]);
  for (const d of distractorPool) {
    if (distractors.length >= 3) break;
    const val = type === 'name-to-capital' ? d.capital : d.name;
    if (!used.has(val)) {
      distractors.push(val);
      used.add(val);
    }
  }
  return { type, country, answer, choices: shuffle([answer, ...distractors]) };
}

// ─── Quiz award tiers + best-score persistence (per-device) ──────────────────

export interface QuizTier {
  name: 'Gold' | 'Silver' | 'Bronze';
  threshold: number;
  emoji: string;
  border: string;
  bg: string;
}

export const QUIZ_TIERS: QuizTier[] = [
  { name: 'Gold', threshold: 15, emoji: '🥇', border: 'border-yellow-500', bg: 'bg-yellow-50' },
  { name: 'Silver', threshold: 10, emoji: '🥈', border: 'border-gray-400', bg: 'bg-gray-50' },
  { name: 'Bronze', threshold: 5, emoji: '🥉', border: 'border-orange-400', bg: 'bg-orange-50' },
];

export function getQuizTier(score: number): QuizTier | null {
  for (const tier of QUIZ_TIERS) {
    if (score >= tier.threshold) return tier;
  }
  return null;
}

export function getNextQuizTier(score: number): QuizTier | null {
  for (let i = QUIZ_TIERS.length - 1; i >= 0; i--) {
    if (score < QUIZ_TIERS[i]!.threshold) return QUIZ_TIERS[i]!;
  }
  return null;
}

/**
 * Best-score localStorage key. Per-device only: World Flags timed-quiz
 * scores are not yet server-persisted (tracked as a follow-up).
 */
export function bestScoreKey(memberId: string, continent: string): string {
  return continent === 'All'
    ? `worldFlags_${memberId}_quizBest`
    : `worldFlags_${memberId}_quizBest_${continent}`;
}

export function readBestScore(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeBestScore(key: string, score: number): void {
  try {
    localStorage.setItem(key, String(score));
  } catch {
    /* ignore: best score is best-effort */
  }
}
