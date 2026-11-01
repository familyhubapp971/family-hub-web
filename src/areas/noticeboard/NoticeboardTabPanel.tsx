import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, Pencil, Pin, X } from 'lucide-react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-232 / FHS-266: NoticeboardTabPanel (Magic Patterns layout).
//
// Family bulletin board as a wrapping grid of post-it cards inside a
// lime panel. Each note: an emoji icon, a pin marker, the text, and a
// "From <author>" footer; pinned notes float to the top. Posting opens
// an inline form with an emoji picker; admins/adults can delete.

interface Notice {
  id: string;
  body: string;
  pinned: boolean;
  authorMemberId: string | null;
  authorName: string | null;
  icon: string | null;
  createdAt: string;
}

interface ListNoticesResponse {
  notices: Notice[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; notices: Notice[] }
  | { kind: 'error'; message: string };

// Post-it background colours, cycled by card position so the board reads
// as a lively wall rather than a uniform list.
const CARD_COLORS = [
  'bg-yellow-100',
  'bg-pink-100',
  'bg-cyan-100',
  'bg-orange-100',
  'bg-violet-100',
  'bg-lime-50',
];

const ICON_CHOICES = ['📌', '🎉', '📅', '🛒', '⚠️', '❤️', '🏆', '🍕'];

export function NoticeboardTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ body: string; pinned: boolean; icon: string }>({
    body: '',
    pinned: false,
    icon: '📌',
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // FHS-313: gates the Post/Edit/Delete affordances by the caller's own
  // role (admin/adult), the same rule the API already enforces
  // server-side. Fetched once, same pattern as RewardRequestsPanel.
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const deletingRef = useRef<Set<string>>(new Set());

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const refetch = useCallback(async () => {
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/api/notices`, { headers });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load notices (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListNoticesResponse;
      setStatus({ kind: 'ready', notices: body.notices });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error. Try again.',
      });
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/members`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((b: { callerRole?: string }) => setCallerRole(b.callerRole ?? null))
      .catch(() => {
        /* unknown role: controls stay hidden until it resolves */
      });
    return () => ac.abort();
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notices`, { headers, signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load notices (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListNoticesResponse;
        if (!cancelled) setStatus({ kind: 'ready', notices: body.notices });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error. Try again.',
        });
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [headers]);

  const onAddOpen = useCallback(() => {
    setAdding(true);
    setEditingId(null);
    setSaveError(null);
    setDraft({ body: '', pinned: false, icon: '📌' });
  }, []);

  const onAddCancel = useCallback(() => {
    setAdding(false);
    setEditingId(null);
    setSaveError(null);
    setDraft({ body: '', pinned: false, icon: '📌' });
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!headers || savingRef.current) return;
      const trimmed = draft.body.trim();
      if (!trimmed) {
        setSaveError('Note text is required.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const url = editingId ? `${API_BASE}/api/notices/${editingId}` : `${API_BASE}/api/notices`;
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed, pinned: draft.pinned, icon: draft.icon }),
        });
        if (!res.ok) {
          // FHS-313: someone else deleted this note while it was open
          // for editing. Refresh the list so the dead card drops off,
          // and say so in plain words instead of a generic error.
          if (res.status === 404 && editingId) {
            setSaveError('This note was removed elsewhere. The list has been refreshed.');
            await refetch();
            return;
          }
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              detail?: string;
              issues?: Array<{ message?: string }>;
            };
            if (body.detail) detail = body.detail;
            else if (body.issues?.[0]?.message) detail = body.issues[0].message;
            else if (body.error) detail = body.error;
          } catch {
            /* non-JSON body */
          }
          setSaveError(detail);
          return;
        }
        setAdding(false);
        setEditingId(null);
        setStatusAnnouncement(
          editingId ? 'Note updated' : draft.pinned ? 'Pinned note added' : 'Note added',
        );
        setErrorAnnouncement('');
        await refetch();
        requestAnimationFrame(() => addButtonRef.current?.focus());
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, editingId, refetch],
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!headers || deletingRef.current.has(id)) return;
      deletingRef.current.add(id);
      try {
        const res = await fetch(`${API_BASE}/api/notices/${id}`, { method: 'DELETE', headers });
        if (!res.ok) {
          const friendly =
            res.status === 403
              ? 'Only admins and adults can delete notices.'
              : `Couldn't delete note (server returned ${res.status})`;
          setErrorAnnouncement(friendly);
          return;
        }
        setStatusAnnouncement('Note deleted');
        setErrorAnnouncement('');
        await refetch();
      } catch (err) {
        setErrorAnnouncement(
          err instanceof Error ? err.message : "Network error. Couldn't delete note.",
        );
      } finally {
        deletingRef.current.delete(id);
      }
    },
    [headers, refetch],
  );

  const onEditClick = useCallback((n: Notice) => {
    setSaveError(null);
    setEditingId(n.id);
    setAdding(true);
    setDraft({ body: n.body, pinned: n.pinned, icon: n.icon ?? '📌' });
  }, []);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="notices-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading notices…
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p data-testid="notices-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const notices = status.notices;
  // FHS-313: only admins/adults may post, edit, or delete notices
  // (matches the API's WRITE_ROLES). Everyone else just reads the board.
  const canWrite = callerRole === 'admin' || callerRole === 'adult';

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="notices-ready">
      <header className="flex items-end justify-between">
        <h2 className="font-heading text-2xl tracking-wide text-white">Noticeboard</h2>
      </header>

      <p aria-live="polite" className="sr-only" data-testid="notices-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="notices-error-announcement"
      >
        {errorAnnouncement}
      </p>

      <div className="rounded-xl border-2 border-black bg-lime-100 p-4 shadow-neo-sm md:p-6">
        {adding && canWrite && (
          <form
            onSubmit={onAddSubmit}
            className="mb-6 flex flex-col gap-3 rounded-md border-2 border-black bg-white p-4"
            data-testid="notices-add-form"
            aria-label={editingId ? 'Edit note' : 'Post new note'}
          >
            <p className="text-sm font-bold text-black">
              {editingId ? 'Edit note' : 'Post new note'}
            </p>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Note
              <textarea
                required
                rows={2}
                maxLength={2000}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                data-testid="notices-add-body"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <div className="flex flex-wrap items-center gap-1" data-testid="notices-add-icon">
              <span className="mr-1 text-xs font-bold text-gray-600">Icon</span>
              {ICON_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Use icon ${emoji}`}
                  aria-pressed={draft.icon === emoji}
                  onClick={() => setDraft({ ...draft, icon: emoji })}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border-2 text-lg ${
                    draft.icon === emoji ? 'border-black bg-yellow-200' : 'border-gray-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-black">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                data-testid="notices-add-pinned"
                className="h-6 w-6 cursor-pointer accent-yellow-400"
              />
              Pin to top
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="notices-add-error"
                className="text-xs font-bold text-red-600"
              >
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                testId="notices-add-submit"
              >
                {saving ? 'Saving…' : editingId ? 'Update note' : 'Post note'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="notices-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {notices.length === 0 ? (
          <p
            data-testid="notices-empty"
            className="py-4 text-center text-sm font-bold text-lime-800"
          >
            No notes yet. Post the first one.
          </p>
        ) : (
          <ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="notices-grid"
          >
            {notices.map((n, i) => (
              <NoticeCard
                key={n.id}
                notice={n}
                color={CARD_COLORS[i % CARD_COLORS.length]!}
                onDelete={onDelete}
                onEdit={onEditClick}
                canEdit={canWrite}
              />
            ))}
          </ul>
        )}

        {!adding && canWrite && (
          <button
            type="button"
            ref={addButtonRef}
            onClick={onAddOpen}
            data-testid="notices-add"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-lime-600 bg-white/50 py-2.5 font-bold text-lime-800 hover:border-black hover:bg-lime-50 hover:text-black motion-safe:transition-colors"
          >
            <Megaphone size={18} aria-hidden="true" /> Post New Announcement
          </button>
        )}
      </div>
    </div>
  );
}

function NoticeCard({
  notice,
  color,
  onDelete,
  onEdit,
  canEdit,
}: {
  notice: Notice;
  color: string;
  onDelete: (id: string) => void;
  onEdit: (n: Notice) => void;
  canEdit: boolean;
}) {
  return (
    <li data-testid={`notice-row-${notice.id}`}>
      <div
        className={`flex h-full flex-col gap-3 rounded-xl border-2 border-black p-4 shadow-neo-sm motion-safe:transition-transform motion-safe:hover:-translate-y-1 ${color}`}
      >
        <div className="flex items-start justify-between">
          <span
            data-testid={`notice-icon-${notice.id}`}
            className="text-3xl leading-none"
            aria-hidden="true"
          >
            {notice.icon ?? '📌'}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {notice.pinned && (
              <Pin size={16} role="img" className="text-gray-500" aria-label="Pinned" />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(notice)}
                aria-label={`Edit note: ${notice.body.slice(0, 40)}`}
                data-testid={`notice-edit-${notice.id}`}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-gray-500 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onDelete(notice.id)}
                aria-label={`Delete note: ${notice.body.slice(0, 40)}`}
                data-testid={`notice-delete-${notice.id}`}
                className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-gray-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                <X size={16} />
              </button>
            )}
          </span>
        </div>
        <p
          data-testid={`notice-body-${notice.id}`}
          className="flex-1 whitespace-pre-wrap break-words text-base font-bold leading-tight text-black"
        >
          {notice.body}
        </p>
        <div className="border-t-2 border-dashed border-black/20 pt-3">
          <p
            data-testid={`notice-author-${notice.id}`}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500"
          >
            From {notice.authorName ?? 'Family'}
          </p>
        </div>
      </div>
    </li>
  );
}
