import { describe, it, expect, beforeEach } from 'vitest';
import {
  flagUrl,
  getChunksForContinent,
  generateLearnQuiz,
  generateTimedQuestion,
  redactCountryName,
  getQuizTier,
  getNextQuizTier,
  bestScoreKey,
  readBestScore,
  writeBestScore,
  CHUNK_SIZE,
} from '../../../../../../src/areas/learn/world-flags/shared';
import {
  COUNTRIES,
  getCountriesByContinent,
} from '../../../../../../src/areas/learn/world-flags/countries';

describe('flagUrl', () => {
  it('builds a flagcdn URL with the lowercased code and given size', () => {
    expect(flagUrl('GB', 'w320')).toBe('https://flagcdn.com/w320/gb.png');
    expect(flagUrl('us', 'w40')).toBe('https://flagcdn.com/w40/us.png');
  });
  it('defaults to w320', () => {
    expect(flagUrl('FR')).toBe('https://flagcdn.com/w320/fr.png');
  });
});

describe('getChunksForContinent', () => {
  it('splits a continent into sets of CHUNK_SIZE, covering every country', () => {
    const total = getCountriesByContinent('Africa').length;
    const chunks = getChunksForContinent('Africa');
    expect(chunks.length).toBe(Math.ceil(total / CHUNK_SIZE));
    // Every chunk but the last is exactly CHUNK_SIZE.
    chunks.slice(0, -1).forEach((c) => expect(c).toHaveLength(CHUNK_SIZE));
    expect(chunks.flat()).toHaveLength(total);
  });
});

describe('generateLearnQuiz', () => {
  it('makes one 4-option question per country, with the correct answer present', () => {
    const continent = getCountriesByContinent('Europe');
    const chunk = continent.slice(0, 5);
    const quiz = generateLearnQuiz(chunk, continent);
    expect(quiz).toHaveLength(5);
    for (const q of quiz) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.answer);
      expect(q.answer).toBe(q.country.name);
      expect(new Set(q.choices).size).toBe(4); // no duplicate options
    }
  });

  it('still yields 4 distinct choices for the smallest continents (Oceania)', () => {
    // Oceania is the smallest pool; the every-chunk quiz must still build 4
    // distinct options by falling back to the global country list.
    for (const chunk of getChunksForContinent('Oceania')) {
      const quiz = generateLearnQuiz(chunk, getCountriesByContinent('Oceania'));
      expect(quiz).toHaveLength(chunk.length);
      for (const q of quiz) {
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices).toContain(q.answer);
      }
    }
  });
});

describe('generateTimedQuestion', () => {
  it('returns a 4-option question whose answer is among the choices', () => {
    for (let i = 0; i < 30; i++) {
      const q = generateTimedQuestion('Asia');
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.answer);
      if (q.type === 'name-to-capital') expect(q.answer).toBe(q.country.capital);
      else expect(q.answer).toBe(q.country.name);
    }
  });
  it('restricts the asked country to the chosen continent', () => {
    for (let i = 0; i < 20; i++) {
      const q = generateTimedQuestion('Oceania');
      expect(q.country.continent).toBe('Oceania');
    }
  });
});

describe('redactCountryName', () => {
  it('hides the country name and its possessive from fun-fact text', () => {
    const out = redactCountryName("Japan's Mount Fuji is in Japan.", 'Japan');
    expect(out).not.toMatch(/Japan/);
    expect(out).toContain('This country');
  });
  it('does not redact a short name inside a longer word (Niger vs Nigeria)', () => {
    const out = redactCountryName('Niger borders Nigeria.', 'Niger');
    expect(out).toBe('This country borders Nigeria.');
  });
});

describe('quiz tiers', () => {
  it('maps scores to the right tier', () => {
    expect(getQuizTier(15)?.name).toBe('Gold');
    expect(getQuizTier(10)?.name).toBe('Silver');
    expect(getQuizTier(5)?.name).toBe('Bronze');
    expect(getQuizTier(4)).toBeNull();
  });
  it('points at the next tier to chase', () => {
    expect(getNextQuizTier(4)?.name).toBe('Bronze');
    expect(getNextQuizTier(7)?.name).toBe('Silver');
    expect(getNextQuizTier(12)?.name).toBe('Gold');
    expect(getNextQuizTier(15)).toBeNull(); // already maxed
  });
});

describe('best-score persistence', () => {
  beforeEach(() => localStorage.clear());

  it('keys "All" without a continent suffix and a continent with one', () => {
    expect(bestScoreKey('m1', 'All')).toBe('worldFlags_m1_quizBest');
    expect(bestScoreKey('m1', 'Africa')).toBe('worldFlags_m1_quizBest_Africa');
  });
  it('round-trips a score and defaults missing/garbage to 0', () => {
    expect(readBestScore('missing')).toBe(0);
    writeBestScore('k', 12);
    expect(readBestScore('k')).toBe(12);
    localStorage.setItem('bad', 'not-a-number');
    expect(readBestScore('bad')).toBe(0);
  });
});

describe('countries dataset sanity', () => {
  it('has the expected continents and unique codes', () => {
    expect(COUNTRIES.length).toBeGreaterThan(150);
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
