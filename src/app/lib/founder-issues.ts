// FHS-717: issues parents report from a screen's feedback form, as the
// founder's /admin page reads them from GET /api/founder/issues.

export type IssueStatus = 'new' | 'fixed';

export interface IssuePhoto {
  id: string;
  contentType: string;
  sizeBytes: number;
}

export interface FounderIssue {
  id: string;
  createdAt: string;
  screen: string;
  description: string;
  status: IssueStatus;
  fixedAt: string | null;
  familyName: string;
  reporterEmail: string | null;
  reporterName: string | null;
  photos: IssuePhoto[];
}

export function newestFirst(issues: FounderIssue[]): FounderIssue[] {
  return [...issues].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** "Sam Smith · sam@example.com", or whichever of the two is known. */
export function reporterLine(issue: Pick<FounderIssue, 'reporterName' | 'reporterEmail'>): string {
  const parts = [issue.reporterName, issue.reporterEmail].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(' · ') : 'Name and email not known';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;

/** "2 hours ago", in plain words. Older than a month shows the date instead. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return plural(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, 'day');
  if (days < 30) return plural(Math.floor(days / 7), 'week');
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The full date and time, for the tooltip on "2 hours ago". */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
