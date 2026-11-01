import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { Button, Card, ConfirmDialog } from '@familyhub/ui';
import { API_BASE } from '../../app/lib/api';

// FHS-445: "Sync to your calendar" card on the family Calendar tab.
//
// Gives the family a subscribe link (an ICS feed URL) they paste into Google,
// Apple, or Outlook so their FamilyHub activities show up in their own phone
// calendar. One-way: activities flow OUT to the phone, auto-refreshed by the
// calendar app on its own schedule.
//
// Collapsed by default so it never crowds the week view. The feed key is only
// created when a family actually opens the card (lazy GET /api/calendar/feed).
// "Regenerate link" is admin-only and breaks any existing subscription, so it
// sits behind a confirm.

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function CalendarSyncCard({ headers }: { headers: Record<string, string> | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [isAdmin, setIsAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateFailed, setRotateFailed] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!headers) return;
    setStatus('loading');
    try {
      const [feedRes, membersRes] = await Promise.all([
        fetch(`${API_BASE}/api/calendar/feed`, { headers }),
        fetch(`${API_BASE}/api/members`, { headers }),
      ]);
      if (!feedRes.ok) {
        setStatus('error');
        return;
      }
      const body = (await feedRes.json()) as { url?: string };
      setUrl(body.url ?? null);
      if (membersRes.ok) {
        const m = (await membersRes.json()) as { callerRole?: string };
        setIsAdmin(m.callerRole === 'admin');
      }
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [headers]);

  // Lazily load the feed the first time the card is opened.
  useEffect(() => {
    if (open && status === 'idle') void loadFeed();
  }, [open, status, loadFeed]);

  const onCopy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still on-screen to copy by hand.
    }
  }, [url]);

  const onRotate = useCallback(async () => {
    if (!headers) return;
    setRotating(true);
    setRotateFailed(false);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/feed/rotate`, { method: 'POST', headers });
      if (res.ok) {
        const body = (await res.json()) as { url?: string };
        setUrl(body.url ?? url);
        setConfirmRotate(false);
      } else {
        // The old link is still live: the user MUST see it didn't work.
        setRotateFailed(true);
        setConfirmRotate(false);
      }
    } catch {
      setRotateFailed(true);
      setConfirmRotate(false);
    } finally {
      setRotating(false);
    }
  }, [headers, url]);

  return (
    <Card className="bg-white p-0" testId="calendar-sync-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
        data-testid="calendar-sync-toggle"
      >
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-black bg-pink-200 shadow-neo-xs"
          aria-hidden="true"
        >
          <CalendarPlus size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base sm:text-lg">Sync to your calendar</span>
          <span className="block truncate font-body text-xs text-gray-500 sm:text-sm">
            Add your family activities to Google, Apple, or Outlook.
          </span>
        </span>
        <ChevronDown
          size={22}
          aria-hidden="true"
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t-2 border-black p-4 sm:p-5" data-testid="calendar-sync-body">
          {status === 'loading' && (
            <p className="font-body text-sm text-gray-500">Getting your link…</p>
          )}
          {status === 'error' && (
            <div className="font-body text-sm text-red-700" role="alert">
              Couldn&rsquo;t load your calendar link.{' '}
              <button type="button" onClick={() => void loadFeed()} className="font-bold underline">
                Try again
              </button>
            </div>
          )}
          {status === 'ready' && url && (
            <div className="space-y-4">
              <p className="font-body text-sm text-gray-700">
                Copy this link and add it to your calendar app once. New and changed activities then
                show up automatically. Keep it private, anyone with the link can see your family
                schedule.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code
                  className="min-w-0 flex-1 truncate rounded-lg border-2 border-black bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-800 sm:text-sm"
                  data-testid="calendar-sync-url"
                >
                  {url}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onCopy}
                  testId="calendar-sync-copy"
                  className="w-full sm:w-auto"
                >
                  <Copy size={16} aria-hidden="true" /> {copied ? 'Copied!' : 'Copy link'}
                </Button>
              </div>

              <div className="rounded-lg border-2 border-black bg-yellow-50 p-3 sm:p-4">
                <p className="mb-2 font-heading text-xs uppercase tracking-wide text-gray-700">
                  How to add it
                </p>
                <ul className="space-y-1.5 font-body text-xs text-gray-700 sm:text-sm">
                  <li>
                    <span className="font-bold">Google Calendar:</span> Other calendars → + → From
                    URL → paste → Add calendar.
                  </li>
                  <li>
                    <span className="font-bold">Apple (iPhone):</span> Calendar → Calendars → Add
                    Calendar → Add Subscription Calendar → paste.
                  </li>
                  <li>
                    <span className="font-bold">Outlook:</span> Add calendar → Subscribe from web →
                    paste → Import.
                  </li>
                </ul>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-2 border-t-2 border-dashed border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-body text-xs text-gray-500">
                    Lost the link or shared it by mistake? Make a new one, the old link stops
                    working.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRotate(true)}
                    testId="calendar-sync-rotate"
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw size={15} aria-hidden="true" /> Regenerate link
                  </Button>
                </div>
              )}
              {rotateFailed && (
                <p
                  className="font-body text-xs font-bold text-red-700"
                  role="alert"
                  data-testid="calendar-sync-rotate-error"
                >
                  Couldn&rsquo;t make a new link, your old link is still active. Please try again.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmRotate}
        title="Regenerate calendar link?"
        message="Your current link stops working right away. Anyone already subscribed will need the new link to keep seeing your calendar."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        busy={rotating}
        onConfirm={() => void onRotate()}
        onCancel={() => setConfirmRotate(false)}
      />
    </Card>
  );
}
