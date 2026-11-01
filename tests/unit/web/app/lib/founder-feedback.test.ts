// FHS-672: shaping feedback for the founder's /admin page.
import { describe, it, expect } from 'vitest';
import {
  groupByPersonAndVisit,
  overview,
  quotes,
  screenLabel,
  summariseByScreen,
  toCsv,
  type FeedbackRow,
} from '../../../../../src/app/lib/founder-feedback';

function row(over: Partial<FeedbackRow>): FeedbackRow {
  return {
    source: 'screen',
    familySlug: 'smiths',
    familyName: 'Smith Family',
    name: null,
    email: 'sam@example.com',
    visitId: 'v1',
    screen: 'meals',
    features: [],
    pmfDisappointment: null,
    recommendScore: null,
    solvesProblem: null,
    easeOfUse: null,
    keepUsing: null,
    painPoint: null,
    featureRequest: null,
    otherFeedback: null,
    createdAt: '2026-10-20T10:00:00.000Z',
    ...over,
  };
}

describe('screenLabel', () => {
  it('uses the name the parent saw', () => {
    expect(screenLabel('meals')).toBe('Weekly Meals');
    expect(screenLabel('home')).toBe('The Family Dashboard');
  });

  it('keeps an unknown key as it is', () => {
    expect(screenLabel('somewhere-new')).toBe('Somewhere-new');
  });
});

describe('summariseByScreen', () => {
  it('averages each rating and counts the parts mentioned', () => {
    const [meals] = summariseByScreen([
      row({ easeOfUse: 4, features: ['Add meal'] }),
      row({ easeOfUse: 2, features: ['Add meal', 'Add snack'], email: 'jo@example.com' }),
      row({ source: 'in_app', screen: null, easeOfUse: 1 }),
    ]);
    expect(meals).toMatchObject({ screen: 'meals', answers: 2, people: 2, easeOfUse: 3 });
    expect(meals!.solvesProblem).toBeNull();
    expect(meals!.features).toEqual([
      { name: 'Add meal', count: 2 },
      { name: 'Add snack', count: 1 },
    ]);
  });

  it('puts the busiest screen first', () => {
    const out = summariseByScreen([
      row({ screen: 'calendar' }),
      row({ screen: 'meals' }),
      row({ screen: 'meals' }),
    ]);
    expect(out.map((s) => s.screen)).toEqual(['meals', 'calendar']);
  });
});

describe('groupByPersonAndVisit', () => {
  it("keeps one person's answers from one visit together", () => {
    const [sam] = groupByPersonAndVisit([
      row({ screen: 'meals', createdAt: '2026-10-20T10:00:00.000Z' }),
      row({ screen: 'calendar', createdAt: '2026-10-20T10:05:00.000Z' }),
      row({ visitId: 'v2', createdAt: '2026-10-21T09:00:00.000Z' }),
    ]);
    expect(sam!.visits.map((v) => [v.visitId, v.rows.length])).toEqual([
      ['v2', 1],
      ['v1', 2],
    ]);
  });

  it('keeps each survey answer on its own', () => {
    const [anon] = groupByPersonAndVisit([
      row({ source: 'public', visitId: null, email: null, familySlug: null, familyName: null }),
      row({ source: 'public', visitId: null, email: null, familySlug: null, familyName: null }),
    ]);
    expect(anon!.person).toBe('Anonymous');
    expect(anon!.visits).toHaveLength(2);
  });
});

describe('toCsv', () => {
  it("never lets a spreadsheet run a parent's words as a formula", () => {
    const csv = toCsv([row({ otherFeedback: '=HYPERLINK("x")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('keeps commas, quotes and line breaks inside one cell', () => {
    const csv = toCsv([row({ otherFeedback: 'Meals, then "chores"\nthen bed' })]);
    expect(csv).toContain('"Meals, then ""chores""\nthen bed"');
  });

  it('guards cells that start with a tab', () => {
    expect(toCsv([row({ otherFeedback: '\t=1+1' })])).toContain("'\t=1+1");
  });

  it('names the screen the way the parent saw it', () => {
    expect(toCsv([row({ features: ['Add meal', 'Add snack'] })])).toContain(
      'Weekly Meals,Add meal; Add snack',
    );
  });
});

describe('overview', () => {
  it('counts answers, people, families and averages each rating', () => {
    const o = overview([
      row({ solvesProblem: 4, recommendScore: 8, pmfDisappointment: 'very' }),
      row({
        solvesProblem: 2,
        email: 'jo@example.com',
        familySlug: 'jones',
        pmfDisappointment: 'not',
      }),
    ]);
    expect(o).toMatchObject({ answers: 2, people: 2, families: 2 });
    expect(o.solvesProblem).toEqual({ average: 3, count: 2 });
    expect(o.recommend).toEqual({ average: 8, count: 1 });
    expect(o.missIt).toEqual({ very: 1, somewhat: 0, not: 1 });
  });
});

describe('quotes', () => {
  it('pulls every written answer, newest first, with who and where', () => {
    const out = quotes([
      row({ featureRequest: 'Old wish', createdAt: '2026-10-01T00:00:00.000Z' }),
      row({ painPoint: 'Hard bit', otherFeedback: '  ', createdAt: '2026-10-02T00:00:00.000Z' }),
    ]);
    expect(out.map((q) => [q.kind, q.text])).toEqual([
      ['pain', 'Hard bit'],
      ['wish', 'Old wish'],
    ]);
    expect(out[0]).toMatchObject({ who: 'sam@example.com', where: 'Weekly Meals' });
  });
});
