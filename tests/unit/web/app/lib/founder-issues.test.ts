// FHS-717: shaping issue reports for the founder's /admin page.
import { describe, it, expect } from 'vitest';
import {
  newestFirst,
  reporterLine,
  timeAgo,
  type FounderIssue,
} from '../../../../../src/app/lib/founder-issues';

const NOW = Date.parse('2026-11-01T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  it.each([
    [10_000, 'just now'],
    [MIN, '1 minute ago'],
    [5 * MIN, '5 minutes ago'],
    [HOUR, '1 hour ago'],
    [2 * HOUR + 10 * MIN, '2 hours ago'],
    [DAY, '1 day ago'],
    [3 * DAY, '3 days ago'],
    [8 * DAY, '1 week ago'],
    [20 * DAY, '2 weeks ago'],
  ])('says %ims ago as "%s"', (ms, words) => {
    expect(timeAgo(ago(ms), NOW)).toBe(words);
  });

  it('shows the date for anything older than a month', () => {
    expect(timeAgo('2026-08-03T09:00:00.000Z', NOW)).toMatch(/2026/);
  });

  it('never says a time in the future', () => {
    expect(timeAgo(new Date(NOW + HOUR).toISOString(), NOW)).toBe('just now');
  });
});

describe('reporterLine', () => {
  it('shows the name and the email', () => {
    expect(reporterLine({ reporterName: 'Sam Smith', reporterEmail: 'sam@example.com' })).toBe(
      'Sam Smith · sam@example.com',
    );
  });

  it('shows whichever one is known', () => {
    expect(reporterLine({ reporterName: null, reporterEmail: 'sam@example.com' })).toBe(
      'sam@example.com',
    );
  });

  it('says plainly when neither is known', () => {
    expect(reporterLine({ reporterName: null, reporterEmail: null })).toBe(
      'Name and email not known',
    );
  });
});

describe('newestFirst', () => {
  it('puts the latest report at the top', () => {
    const at = (id: string, createdAt: string) => ({ id, createdAt }) as FounderIssue;
    const sorted = newestFirst([
      at('old', '2026-10-01T00:00:00Z'),
      at('new', '2026-10-30T00:00:00Z'),
      at('mid', '2026-10-15T00:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
  });
});
