// FHS-672: shaping the founder's feedback list for the /admin page.

import { screenFeedbackByKey } from './screen-feedback';

export interface FeedbackRow {
  source: 'in_app' | 'screen' | 'public';
  familySlug: string | null;
  familyName: string | null;
  name: string | null;
  email: string | null;
  visitId: string | null;
  screen: string | null;
  features: string[];
  pmfDisappointment: string | null;
  recommendScore: number | null;
  solvesProblem: number | null;
  easeOfUse: number | null;
  keepUsing: number | null;
  painPoint: string | null;
  featureRequest: string | null;
  otherFeedback: string | null;
  createdAt: string;
}

export const SOURCE_LABEL: Record<FeedbackRow['source'], string> = {
  screen: 'Per-screen form',
  in_app: 'In-app survey',
  public: 'Homepage survey',
};

/** "meals" -> "Weekly Meals", with a capital first letter. */
export function screenLabel(key: string): string {
  const area = screenFeedbackByKey(key).key === 'other' ? key : screenFeedbackByKey(key).area;
  return area.charAt(0).toUpperCase() + area.slice(1);
}

function average(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

export interface ScreenSummary {
  screen: string;
  answers: number;
  people: number;
  solvesProblem: number | null;
  easeOfUse: number | null;
  keepUsing: number | null;
  features: Array<{ name: string; count: number }>;
}

/** One line per screen, busiest first. Only the per-screen form has a screen. */
export function summariseByScreen(rows: FeedbackRow[]): ScreenSummary[] {
  const groups = new Map<string, FeedbackRow[]>();
  for (const r of rows) {
    if (!r.screen) continue;
    groups.set(r.screen, [...(groups.get(r.screen) ?? []), r]);
  }
  const pick = (rs: FeedbackRow[], k: 'solvesProblem' | 'easeOfUse' | 'keepUsing') =>
    average(rs.map((r) => r[k]).filter((v): v is number => v !== null));
  return [...groups]
    .map(([screen, rs]) => {
      const counts = new Map<string, number>();
      for (const f of rs.flatMap((r) => r.features)) counts.set(f, (counts.get(f) ?? 0) + 1);
      return {
        screen,
        answers: rs.length,
        people: new Set(rs.map((r) => r.email ?? r.name ?? '?')).size,
        solvesProblem: pick(rs, 'solvesProblem'),
        easeOfUse: pick(rs, 'easeOfUse'),
        keepUsing: pick(rs, 'keepUsing'),
        features: [...counts]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => b.answers - a.answers || a.screen.localeCompare(b.screen));
}

export interface VisitGroup {
  visitId: string | null;
  rows: FeedbackRow[];
}

export interface PersonGroup {
  key: string;
  family: string | null;
  person: string;
  visits: VisitGroup[];
}

/**
 * Person by person (most recent first), then visit by visit, so one parent's
 * answers from one visit sit together. Answers with no visit ID (the surveys)
 * each stand alone.
 */
export function groupByPersonAndVisit(rows: FeedbackRow[]): PersonGroup[] {
  const people = new Map<string, PersonGroup>();
  const newestFirst = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const r of newestFirst) {
    const person = r.email ?? r.name ?? 'Anonymous';
    const key = `${r.familySlug ?? r.source}|${person}`;
    const group = people.get(key) ?? {
      key,
      family: r.familyName ?? r.familySlug,
      person,
      visits: [],
    };
    const visit = r.visitId ? group.visits.find((v) => v.visitId === r.visitId) : undefined;
    if (visit) visit.rows.push(r);
    else group.visits.push({ visitId: r.visitId, rows: [r] });
    people.set(key, group);
  }
  return [...people.values()];
}

const CSV_COLUMNS: Array<[string, (r: FeedbackRow) => unknown]> = [
  ['source', (r) => SOURCE_LABEL[r.source]],
  ['family', (r) => r.familyName ?? r.familySlug],
  ['person', (r) => r.email ?? r.name],
  ['visit_id', (r) => r.visitId],
  ['screen', (r) => (r.screen ? screenLabel(r.screen) : '')],
  ['features', (r) => r.features.join('; ')],
  ['pmf_disappointment', (r) => r.pmfDisappointment],
  ['recommend_score', (r) => r.recommendScore],
  ['solves_problem', (r) => r.solvesProblem],
  ['ease_of_use', (r) => r.easeOfUse],
  ['keep_using', (r) => r.keepUsing],
  ['pain_point', (r) => r.painPoint],
  ['feature_request', (r) => r.featureRequest],
  ['other_feedback', (r) => r.otherFeedback],
  ['created_at', (r) => r.createdAt],
];

/** Spreadsheet text. Cells starting with = + - @ tab or return get a leading quote so a
 *  spreadsheet never runs a parent's words as a formula. */
export function toCsv(rows: FeedbackRow[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.map(([h]) => h).join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return lines.join('\n') + '\n';
}

// ─── FHS-675: the visual view ─────────────────────────────────────────────────

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface Overview {
  answers: number;
  people: number;
  families: number;
  recommend: RatingSummary;
  solvesProblem: RatingSummary;
  easeOfUse: RatingSummary;
  keepUsing: RatingSummary;
  /** "How would you feel without it?" counts. */
  missIt: { very: number; somewhat: number; not: number };
}

function rating(rows: FeedbackRow[], pick: (r: FeedbackRow) => number | null): RatingSummary {
  const xs = rows.map(pick).filter((v): v is number => v !== null);
  return { average: average(xs), count: xs.length };
}

export function overview(rows: FeedbackRow[]): Overview {
  const missIt = { very: 0, somewhat: 0, not: 0 };
  for (const r of rows) {
    if (r.pmfDisappointment === 'very') missIt.very++;
    else if (r.pmfDisappointment === 'somewhat') missIt.somewhat++;
    else if (r.pmfDisappointment === 'not') missIt.not++;
  }
  return {
    answers: rows.length,
    people: new Set(rows.map((r) => r.email ?? r.name ?? 'Anonymous')).size,
    families: new Set(rows.map((r) => r.familySlug).filter(Boolean)).size,
    recommend: rating(rows, (r) => r.recommendScore),
    solvesProblem: rating(rows, (r) => r.solvesProblem),
    easeOfUse: rating(rows, (r) => r.easeOfUse),
    keepUsing: rating(rows, (r) => r.keepUsing),
    missIt,
  };
}

export type QuoteKind = 'wish' | 'pain' | 'other';

export interface Quote {
  kind: QuoteKind;
  text: string;
  who: string;
  where: string;
  createdAt: string;
}

/** Every written answer, newest first, with who said it and where. */
export function quotes(rows: FeedbackRow[]): Quote[] {
  const out: Quote[] = [];
  for (const r of rows) {
    const who = r.email ?? r.name ?? 'Anonymous';
    const where = r.screen ? screenLabel(r.screen) : SOURCE_LABEL[r.source];
    const add = (kind: QuoteKind, text: string | null) => {
      if (text?.trim()) out.push({ kind, text: text.trim(), who, where, createdAt: r.createdAt });
    };
    add('wish', r.featureRequest);
    add('pain', r.painPoint);
    add('other', r.otherFeedback);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
