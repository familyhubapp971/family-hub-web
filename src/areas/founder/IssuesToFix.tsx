/**
 * IssuesToFix: FHS-717, the top of the founder's /admin page.
 *
 * Problems parents reported from a screen's feedback form, with their photos.
 * The founder works down the New list and marks each one fixed; Reopen puts
 * it back. Photos only load with the founder pass, so each one is fetched
 * with it and shown from a short-lived browser address, let go of when the
 * page closes.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, Dialog } from '@familyhub/ui';
import { API_BASE } from '../../app/lib/api';
import { screenLabel } from '../../app/lib/founder-feedback';
import {
  fullDate,
  newestFirst,
  reporterLine,
  timeAgo,
  type FounderIssue,
  type IssuePhoto,
  type IssueStatus,
} from '../../app/lib/founder-issues';

type LoadPhoto = (issueId: string, photoId: string) => Promise<string | null>;

interface Enlarged {
  url: string;
  title: string;
  alt: string;
}

const FILTERS: Array<{ status: IssueStatus; label: string; empty: string }> = [
  { status: 'new', label: 'New', empty: 'No issues to fix. Nice.' },
  { status: 'fixed', label: 'Fixed', empty: 'Nothing marked fixed yet.' },
];

export function IssuesToFix({
  token,
  onUnauthorized,
}: {
  token: string;
  /** The founder pass has run out: lock the page again. */
  onUnauthorized: () => void;
}) {
  const titleId = useId();
  const [issues, setIssues] = useState<FounderIssue[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<IssueStatus>('new');
  const [saving, setSaving] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const [enlarged, setEnlarged] = useState<Enlarged | null>(null);

  // One download per photo, shared by every card that shows it, so switching
  // between New and Fixed does not fetch the photos again.
  const photoCache = useRef(new Map<string, Promise<string | null>>());
  const madeUrls = useRef<string[]>([]);
  const gone = useRef(false);

  useEffect(() => {
    gone.current = false;
    const urls = madeUrls.current;
    return () => {
      gone.current = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    setIssues(null);
    fetch(`${API_BASE}/api/founder/issues`, { headers: { 'x-founder-token': token } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return onUnauthorized();
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { issues: FounderIssue[] };
        if (!cancelled) setIssues(newestFirst(body.issues));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onUnauthorized, attempt]);

  const loadPhoto = useCallback<LoadPhoto>(
    (issueId, photoId) => {
      const key = `${issueId}/${photoId}`;
      const cached = photoCache.current.get(key);
      if (cached) return cached;
      const path = `/api/founder/issues/${encodeURIComponent(issueId)}/photos/${encodeURIComponent(photoId)}`;
      const pending = fetch(`${API_BASE}${path}`, { headers: { 'x-founder-token': token } })
        .then(async (res) => {
          if (res.status === 401) onUnauthorized();
          if (!res.ok) throw new Error(String(res.status));
          const url = URL.createObjectURL(await res.blob());
          if (gone.current) {
            URL.revokeObjectURL(url);
            return null;
          }
          madeUrls.current.push(url);
          return url;
        })
        .catch(() => {
          // Forget the failure, so the photo is fetched again next time.
          photoCache.current.delete(key);
          return null;
        });
      photoCache.current.set(key, pending);
      return pending;
    },
    [token, onUnauthorized],
  );

  const setStatus = useCallback(
    async (issue: FounderIssue, status: IssueStatus) => {
      const before = { status: issue.status, fixedAt: issue.fixedAt };
      const patch = (id: string, change: Partial<FounderIssue>) =>
        setIssues((cur) => cur?.map((i) => (i.id === id ? { ...i, ...change } : i)) ?? cur);

      setSaveError('');
      setSaving((cur) => [...cur, issue.id]);
      // Moved straight away, so the list feels instant; put back if it fails.
      patch(issue.id, { status, fixedAt: status === 'fixed' ? new Date().toISOString() : null });
      try {
        const res = await fetch(`${API_BASE}/api/founder/issues/${encodeURIComponent(issue.id)}`, {
          method: 'PATCH',
          headers: {
            'x-founder-token': token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ status }),
        });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const saved = (await res.json().catch(() => null)) as {
          status?: IssueStatus;
          fixedAt?: string | null;
        } | null;
        if (saved?.status)
          patch(issue.id, { status: saved.status, fixedAt: saved.fixedAt ?? null });
      } catch {
        patch(issue.id, before);
        setSaveError(
          status === 'fixed'
            ? 'Could not mark that issue fixed. Please try again.'
            : 'Could not reopen that issue. Please try again.',
        );
      } finally {
        setSaving((cur) => cur.filter((id) => id !== issue.id));
      }
    },
    [token, onUnauthorized],
  );

  const counts = {
    new: issues?.filter((i) => i.status === 'new').length ?? 0,
    fixed: issues?.filter((i) => i.status === 'fixed').length ?? 0,
  };
  const shown = issues?.filter((i) => i.status === filter) ?? [];
  const current = FILTERS.find((f) => f.status === filter)!;

  return (
    <section aria-labelledby={titleId} data-testid="founder-issues">
      <h2 id={titleId} className="mb-3 flex items-center gap-2 font-heading text-xl">
        <span aria-hidden="true">🛠️</span>
        Issues to fix
        {issues && (
          <span
            className="rounded-full bg-white/20 px-2 text-sm"
            data-testid="founder-issues-count"
          >
            {counts.new}
          </span>
        )}
      </h2>

      {loadFailed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-black bg-red-50 p-4 text-red-700"
          data-testid="founder-issues-error"
        >
          <p className="font-bold">Could not load issues. Check your connection.</p>
          <Button
            variant="secondary"
            onClick={() => setAttempt((n) => n + 1)}
            testId="founder-issues-retry"
            className="min-h-[44px]"
          >
            Try again
          </Button>
        </div>
      ) : issues === null ? (
        <IssuesLoading />
      ) : (
        <div className="space-y-4">
          <div role="group" aria-label="Show issues" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const on = filter === f.status;
              return (
                <button
                  key={f.status}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.status)}
                  data-testid={`founder-issues-filter-${f.status}`}
                  className={[
                    'flex min-h-[44px] items-center gap-2 rounded-full border-2 border-black px-4 py-2 text-sm font-black text-black transition-colors',
                    'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                    on ? 'bg-yellow-300 shadow-neo-sm' : 'bg-white hover:bg-yellow-100',
                  ].join(' ')}
                >
                  {f.label}
                  <span className="rounded-full bg-black/10 px-2 text-xs">{counts[f.status]}</span>
                </button>
              );
            })}
          </div>

          {saveError && (
            <p
              role="alert"
              className="rounded-xl border-2 border-black bg-red-50 p-3 text-sm font-bold text-red-700"
              data-testid="founder-issues-save-error"
            >
              {saveError}
            </p>
          )}

          {shown.length === 0 ? (
            <p className="text-purple-200" data-testid="founder-issues-empty">
              {current.empty}
            </p>
          ) : (
            <ul className="space-y-3">
              {shown.map((issue) => (
                <li key={issue.id}>
                  <IssueCard
                    issue={issue}
                    saving={saving.includes(issue.id)}
                    onSetStatus={setStatus}
                    loadPhoto={loadPhoto}
                    onEnlarge={setEnlarged}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog
        isOpen={enlarged !== null}
        onClose={() => setEnlarged(null)}
        ariaLabel={enlarged?.title ?? 'Photo'}
        testId="founder-issue-photo-dialog"
      >
        {enlarged && (
          <div className="flex min-h-0 flex-col items-center gap-3 rounded-2xl border-2 border-black bg-white p-3 shadow-neo-lg">
            <img
              src={enlarged.url}
              alt={enlarged.alt}
              className="min-h-0 max-h-[calc(100vh-9rem)] max-w-full rounded-xl object-contain supports-[height:100dvh]:max-h-[calc(100dvh-9rem)]"
              data-testid="founder-issue-photo-large"
            />
            <Button
              variant="secondary"
              onClick={() => setEnlarged(null)}
              testId="founder-issue-photo-close"
              className="min-h-[44px]"
            >
              Close
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function IssueCard({
  issue,
  saving,
  onSetStatus,
  loadPhoto,
  onEnlarge,
}: {
  issue: FounderIssue;
  saving: boolean;
  onSetStatus: (issue: FounderIssue, status: IssueStatus) => void;
  loadPhoto: LoadPhoto;
  onEnlarge: (photo: Enlarged) => void;
}) {
  const headingId = useId();
  const area = screenLabel(issue.screen);
  const family = issue.familyName || 'Family not known';
  const isNew = issue.status === 'new';

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo"
      data-testid="founder-issue"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h3 id={headingId} className="font-heading text-lg">
            {area}
          </h3>
          <p className="text-sm font-bold">{family}</p>
          <p className="break-words text-sm text-gray-700">{reporterLine(issue)}</p>
          <p className="text-xs font-bold text-gray-500">
            <time dateTime={issue.createdAt} title={fullDate(issue.createdAt)}>
              {timeAgo(issue.createdAt)}
            </time>
            {!isNew && issue.fixedAt && (
              <>
                {' · Fixed '}
                <time dateTime={issue.fixedAt} title={fullDate(issue.fixedAt)}>
                  {timeAgo(issue.fixedAt)}
                </time>
              </>
            )}
          </p>
        </div>
        <Button
          variant={isNew ? 'success' : 'secondary'}
          onClick={() => onSetStatus(issue, isNew ? 'fixed' : 'new')}
          disabled={saving}
          aria-describedby={headingId}
          testId="founder-issue-toggle"
          className="min-h-[44px] shrink-0 self-start disabled:opacity-50"
        >
          {isNew ? 'Mark fixed' : 'Reopen'}
        </Button>
      </div>

      {issue.description.trim() && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium">
          {issue.description}
        </p>
      )}

      {issue.photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Photos">
          {issue.photos.map((photo, i) => (
            <li key={photo.id}>
              <IssuePhotoThumb
                issueId={issue.id}
                photo={photo}
                number={i + 1}
                total={issue.photos.length}
                loadPhoto={loadPhoto}
                onOpen={(url) =>
                  onEnlarge({
                    url,
                    title: `Photo ${i + 1} of ${issue.photos.length}`,
                    alt: `Reported on ${area} by ${family}, ${i + 1} of ${issue.photos.length}`,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function IssuePhotoThumb({
  issueId,
  photo,
  number,
  total,
  loadPhoto,
  onOpen,
}: {
  issueId: string;
  photo: IssuePhoto;
  number: number;
  total: number;
  loadPhoto: LoadPhoto;
  onOpen: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPhoto(issueId, photo.id).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [issueId, photo.id, loadPhoto]);

  const box = 'h-20 w-20 rounded-xl border-2 border-black';
  if (failed) {
    return (
      <div
        className={`${box} flex items-center justify-center border-dashed bg-gray-100 p-1 text-center text-xs font-bold text-gray-600`}
        data-testid="founder-issue-photo-failed"
      >
        Photo did not load
      </div>
    );
  }
  if (!url) {
    return (
      <div
        aria-hidden="true"
        className={`${box} bg-gray-200 motion-safe:animate-pulse`}
        data-testid="founder-issue-photo-loading"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      aria-label={`Open photo ${number} of ${total} large`}
      className={`${box} block overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2`}
      data-testid="founder-issue-photo"
    >
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

/** Grey cards the shape of the real ones, while the list loads. */
function IssuesLoading() {
  const bar = 'rounded bg-gray-200 motion-safe:animate-pulse';
  return (
    <div aria-busy="true" className="space-y-3" data-testid="founder-issues-loading">
      <p className="sr-only" role="status">
        Loading issues…
      </p>
      {[0, 1].map((n) => (
        <div
          key={n}
          aria-hidden="true"
          className="rounded-2xl border-2 border-black bg-white p-4 shadow-neo"
        >
          <div className={`${bar} h-5 w-1/3`} />
          <div className={`${bar} mt-2 h-3 w-1/2`} />
          <div className={`${bar} mt-4 h-3 w-full`} />
          <div className="mt-3 flex gap-2">
            <div className={`${bar} h-20 w-20 rounded-xl`} />
            <div className={`${bar} h-20 w-20 rounded-xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}
