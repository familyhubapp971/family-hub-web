import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, Dropdown } from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-231 / FHS-266: AssignmentsTabPanel (Magic Patterns layout).
//
// Family homework / chores. Member filter pills narrow the list; each
// row carries a coloured avatar dot + name badge for who it's for, a
// subject emoji, and a red due-date. Click the circle to toggle done
// (the row dims + strikes through). "+ Add Assignment" opens an inline
// form for title + optional due date.
//
// FHR-39: title capped at 50 characters, notes at 300, and long words wrap
// inside the card. FHR-40: a new due date must be today or later (the
// device's own date). FHR-41: the edit form carries a Delete button behind
// a confirm step.

const TITLE_MAX = 50;
const NOTES_MAX = 300;

interface Assignment {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  memberId: string | null;
  done: boolean;
  doneAt: string | null;
}

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; assignments: Assignment[]; members: MemberLite[] }
  | { kind: 'error'; message: string };

const DOT_COLORS = [
  'bg-rose-200',
  'bg-sky-200',
  'bg-amber-200',
  'bg-violet-200',
  'bg-emerald-200',
  'bg-orange-200',
];

function memberColor(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'bg-yellow-200';
  const idx = members.findIndex((m) => m.id === memberId);
  return DOT_COLORS[(idx < 0 ? 0 : idx) % DOT_COLORS.length]!;
}

function initials(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

// The device's own date as YYYY-MM-DD, so "today" follows the family's
// time zone rather than the server's.
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date';
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function AssignmentsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [filter, setFilter] = useState<string>('all'); // 'all' | memberId
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // FHR-40: the due date the assignment had when editing began. An
  // already-overdue date may stay; only a newly picked date must be today+.
  const [originalDue, setOriginalDue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [draft, setDraft] = useState({ title: '', dueDate: '', memberId: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // FHS-313: gates the Add/Edit affordances by the caller's own role
  // (admin/adult), the same rule the API already enforces server-side.
  // Comes from the same /api/members fetch already used for the member
  // filter pills, so no extra network call.
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const togglingRef = useRef<Set<string>>(new Set());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Mirror the rendered rows so an optimistic toggle can capture the prior
  // row synchronously: capturing it inside the setStatus updater races the
  // network when the PATCH resolves before React commits the update.
  const assignmentsRef = useRef<Assignment[]>([]);

  const onAddCancel = useCallback(() => {
    setAdding(false);
    setEditingId(null);
    setOriginalDue('');
    setSaveError(null);
    setDraft({ title: '', dueDate: '', memberId: '', notes: '' });
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [aRes, mRes] = await Promise.all([
          fetch(`${API_BASE}/api/assignments`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!aRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load assignments (server returned ${aRes.status})`,
          });
          return;
        }
        const aBody = (await aRes.json()) as { assignments: Assignment[] };
        let members: MemberLite[] = [];
        let role: string | null = null;
        if (mRes.ok) {
          const mBody = (await mRes.json()) as { members: MemberLite[]; callerRole?: string };
          members = mBody.members ?? [];
          role = mBody.callerRole ?? null;
        }
        setStatus({ kind: 'ready', assignments: aBody.assignments ?? [], members });
        setCallerRole(role);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error. Try again.',
        });
      }
    },
    [headers],
  );

  useEffect(() => {
    if (!headers) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [headers, load]);

  useEffect(() => {
    if (status.kind === 'ready') assignmentsRef.current = status.assignments;
  }, [status]);

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!headers || savingRef.current) return;
      const trimmedTitle = draft.title.trim();
      if (!trimmedTitle) {
        setSaveError('Title is required.');
        return;
      }
      if (draft.dueDate && draft.dueDate < localToday() && draft.dueDate !== originalDue) {
        setSaveError('Pick today or a later date.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const url = editingId
          ? `${API_BASE}/api/assignments/${editingId}`
          : `${API_BASE}/api/assignments`;
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            dueDate: draft.dueDate || null,
            memberId: draft.memberId || null,
            notes: draft.notes.trim() || null,
          }),
        });
        if (!res.ok) {
          // FHS-313: someone else deleted this assignment while it was
          // open for editing. Refresh the list so the dead row drops
          // off, and say so in plain words instead of a generic error.
          if (res.status === 404 && editingId) {
            setSaveError('This assignment was removed elsewhere. The list has been refreshed.');
            await load();
            return;
          }
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              issues?: Array<{ message?: string }>;
            };
            if (body.issues?.[0]?.message) detail = body.issues[0].message;
            else if (body.error) detail = body.error;
          } catch {
            /* non-JSON */
          }
          setSaveError(detail);
          return;
        }
        setAdding(false);
        setEditingId(null);
        setDraft({ title: '', dueDate: '', memberId: '', notes: '' });
        setStatusAnnouncement(
          editingId ? `"${trimmedTitle}" updated` : `Added assignment "${trimmedTitle}"`,
        );
        setErrorAnnouncement('');
        await load();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, editingId, originalDue, load],
  );

  const onToggleDone = useCallback(
    async (id: string, nextDone: boolean) => {
      if (!headers || togglingRef.current.has(id)) return;
      const priorRow = assignmentsRef.current.find((a) => a.id === id);
      if (!priorRow) return;
      const title = priorRow.title;
      togglingRef.current.add(id);
      setStatus((s) =>
        s.kind === 'ready'
          ? {
              ...s,
              assignments: s.assignments.map((a) =>
                a.id === id
                  ? { ...a, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null }
                  : a,
              ),
            }
          : s,
      );
      const revert = () => {
        setStatus((s) =>
          s.kind === 'ready'
            ? { ...s, assignments: s.assignments.map((a) => (a.id === id ? priorRow : a)) }
            : s,
        );
      };
      try {
        const res = await fetch(`${API_BASE}/api/assignments/${id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: nextDone }),
        });
        if (!res.ok) {
          revert();
          setErrorAnnouncement(`Couldn't update assignment (server returned ${res.status})`);
        } else {
          setStatusAnnouncement(
            nextDone ? `Marked "${title}" done` : `Moved "${title}" back to to-do`,
          );
          setErrorAnnouncement('');
        }
      } catch {
        revert();
        setErrorAnnouncement("Network error. Couldn't update assignment.");
      } finally {
        togglingRef.current.delete(id);
      }
    },
    [headers],
  );

  const onEditClick = useCallback((a: Assignment) => {
    setSaveError(null);
    setEditingId(a.id);
    setOriginalDue(a.dueDate ?? '');
    setAdding(true);
    setDraft({
      title: a.title,
      dueDate: a.dueDate ?? '',
      memberId: a.memberId ?? '',
      notes: a.notes ?? '',
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!headers || !pendingDelete || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${pendingDelete.id}`, {
        method: 'DELETE',
        headers,
      });
      // 404 means someone else already removed it: the outcome is the same.
      if (!res.ok && res.status !== 404) {
        setErrorAnnouncement(`Couldn't delete assignment (server returned ${res.status})`);
        setSaveError(`Couldn't delete (server returned ${res.status})`);
        setPendingDelete(null);
        return;
      }
      setStatusAnnouncement(`Deleted "${pendingDelete.title}"`);
      setErrorAnnouncement('');
      setPendingDelete(null);
      onAddCancel();
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
      setPendingDelete(null);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [headers, pendingDelete, onAddCancel, load]);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="assignments-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading assignments…
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p data-testid="assignments-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const { members } = status;
  const visible = status.assignments.filter((a) => filter === 'all' || a.memberId === filter);
  // FHS-313: only admins/adults may add or edit assignments (matches the
  // API's WRITE_ROLES). Everyone else just sees the list.
  const canWrite = callerRole === 'admin' || callerRole === 'adult';

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="assignments-ready">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <h2 className="font-heading text-2xl tracking-wide text-white">Assignments</h2>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter assignments by member"
        >
          <FilterPill
            testId="assignments-filter-all"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
          />
          {members.map((m) => (
            <FilterPill
              key={m.id}
              testId={`assignments-filter-${m.id}`}
              active={filter === m.id}
              onClick={() => setFilter(m.id)}
              label={m.displayName}
            />
          ))}
        </div>
      </div>

      <p aria-live="polite" className="sr-only" data-testid="assignments-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="assignments-error-announcement"
      >
        {errorAnnouncement}
      </p>

      <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-5">
        {visible.length === 0 ? (
          <p
            data-testid="assignments-empty"
            className="py-4 text-center text-sm font-bold text-gray-500"
          >
            {filter === 'all'
              ? 'Nothing here. Add the first assignment.'
              : 'No assignments for this person yet.'}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="assignments-list">
            {visible.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                members={members}
                onToggle={onToggleDone}
                onEdit={onEditClick}
                canEdit={canWrite}
              />
            ))}
          </ul>
        )}

        {canWrite &&
          (adding ? (
            <form
              onSubmit={onAddSubmit}
              className="mt-5 grid grid-cols-1 gap-3 rounded-md border-2 border-black bg-yellow-50 p-4 sm:grid-cols-2"
              data-testid="assignments-add-form"
              aria-label={editingId ? 'Edit assignment' : 'Add assignment'}
            >
              <p className="col-span-full text-sm font-bold text-black">
                {editingId ? 'Edit assignment' : 'Add assignment'}
              </p>
              <label className="flex flex-col gap-1 text-sm font-bold text-black sm:col-span-2">
                Title
                <input
                  type="text"
                  required
                  maxLength={TITLE_MAX}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  data-testid="assignments-add-title"
                  className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>
              <div className="flex flex-col gap-1 text-sm font-bold text-black">
                For
                <Dropdown
                  ariaLabel="For"
                  testId="assignments-add-member"
                  value={draft.memberId}
                  onChange={(v) => setDraft({ ...draft, memberId: v })}
                  className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded border-2 border-black bg-white px-2 py-1 text-sm font-normal text-black"
                  options={[
                    { value: '', label: 'Whole family' },
                    ...members.map((m) => ({ value: m.id, label: m.displayName })),
                  ]}
                />
              </div>
              <label className="flex flex-col gap-1 text-sm font-bold text-black">
                Due date (optional)
                <input
                  type="date"
                  min={originalDue && originalDue < localToday() ? originalDue : localToday()}
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  data-testid="assignments-add-due"
                  className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold text-black sm:col-span-2">
                Notes (optional)
                <input
                  type="text"
                  maxLength={NOTES_MAX}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  data-testid="assignments-add-notes"
                  className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>
              {draft.title.length > TITLE_MAX && (
                <p
                  data-testid="assignments-title-too-long"
                  className="col-span-full text-xs font-bold text-red-600"
                >
                  This title is over {TITLE_MAX} characters. Shorten it to save.
                </p>
              )}
              {draft.notes.length > NOTES_MAX && (
                <p
                  data-testid="assignments-notes-too-long"
                  className="col-span-full text-xs font-bold text-red-600"
                >
                  These notes are over {NOTES_MAX} characters. Shorten them to save.
                </p>
              )}
              {saveError && (
                <p
                  role="alert"
                  data-testid="assignments-add-error"
                  className="col-span-full text-xs font-bold text-red-600"
                >
                  {saveError}
                </p>
              )}
              <div className="col-span-full flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  testId="assignments-add-submit"
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onAddCancel}
                  disabled={saving}
                  testId="assignments-add-cancel"
                >
                  Cancel
                </Button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({
                        id: editingId,
                        // The saved title, not text typed but not yet saved.
                        title:
                          assignmentsRef.current.find((a) => a.id === editingId)?.title ??
                          draft.title,
                      })
                    }
                    disabled={saving}
                    data-testid="assignments-delete"
                    className="ml-auto flex min-h-[44px] items-center gap-1 rounded px-2 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" /> Delete
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button
              type="button"
              ref={addButtonRef}
              onClick={() => {
                // Opening "Add" must clear any leftover edit state so the
                // form submits a POST, not a PUT (matches Notices/Tasks).
                setEditingId(null);
                setOriginalDue('');
                setDraft({ title: '', dueDate: '', memberId: '', notes: '' });
                setAdding(true);
                setSaveError(null);
              }}
              data-testid="assignments-add"
              className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-400 py-2.5 font-bold text-gray-500 hover:border-black hover:bg-gray-50 hover:text-black motion-safe:transition-colors"
            >
              <Plus size={18} aria-hidden="true" /> Add Assignment
            </button>
          ))}
      </div>
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : ''}
        message="This assignment will be removed for everyone. You can't undo this."
        confirmLabel="Delete"
        variant="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
        testId="assignments-delete-confirm"
      />
    </div>
  );
}

function FilterPill({
  testId,
  active,
  onClick,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] rounded-full border-2 border-black px-3 py-1 text-xs font-bold motion-safe:transition-colors ${
        active ? 'bg-pink-400 text-black shadow-neo-xs' : 'bg-white text-gray-500 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function AssignmentRow({
  assignment,
  members,
  onToggle,
  onEdit,
  canEdit,
}: {
  assignment: Assignment;
  members: MemberLite[];
  onToggle: (id: string, nextDone: boolean) => void;
  onEdit: (a: Assignment) => void;
  canEdit: boolean;
}) {
  const who = members.find((m) => m.id === assignment.memberId);
  const whoLabel = who ? who.displayName : 'Family';
  return (
    <li data-testid={`assignment-row-${assignment.id}`}>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-black p-3 shadow-neo-xs motion-safe:transition-colors ${
          assignment.done ? 'bg-gray-100 opacity-70' : 'bg-white hover:bg-gray-50'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(assignment.id, !assignment.done)}
          aria-label={`Mark "${assignment.title}" ${assignment.done ? 'not done' : 'done'}`}
          data-testid={`assignment-toggle-${assignment.id}`}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          {assignment.done ? (
            <CheckCircle2 size={24} className="fill-green-400" />
          ) : (
            <Circle size={24} />
          )}
        </button>
        <span
          aria-hidden="true"
          data-testid={`assignment-avatar-${assignment.id}`}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black text-xs ${memberColor(
            assignment.memberId,
            members,
          )}`}
          title={whoLabel}
        >
          {who ? (who.avatarEmoji ?? initials(who.displayName)) : '👪'}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-heading text-base text-black [overflow-wrap:anywhere] ${assignment.done ? 'line-through text-gray-500' : ''}`}
            data-testid={`assignment-title-${assignment.id}`}
          >
            <span aria-hidden="true">📚 </span>
            {assignment.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span
              className="flex items-center gap-1 text-xs font-bold text-red-500"
              data-testid={`assignment-due-${assignment.id}`}
            >
              <Clock size={12} aria-hidden="true" /> {formatDueDate(assignment.dueDate)}
            </span>
            <span
              data-testid={`assignment-member-${assignment.id}`}
              className={`rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold ${memberColor(
                assignment.memberId,
                members,
              )}`}
            >
              {whoLabel}
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            aria-label={`Edit "${assignment.title}"`}
            data-testid={`assignment-edit-${assignment.id}`}
            onClick={() => onEdit(assignment)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded border-2 border-black/20 bg-white text-gray-500 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:border-black hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
