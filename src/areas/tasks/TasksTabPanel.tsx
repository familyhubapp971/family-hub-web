import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { notifyDashboardStale } from '../../app/lib/dashboard-refresh';

// FHS-233 / FHS-267: TasksTabPanel (Magic Patterns layout).
//
// A shared family task board (ADR 0013): one column per member, each
// with a "done / total" badge. You SEE every column but can only edit
// your OWN: the caller's column has the circle toggle, delete and an
// inline "+ Add" form; other members' columns are read-only.

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  memberId: string;
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
  | { kind: 'ready'; tasks: Task[]; members: MemberLite[]; callerMemberId: string }
  | { kind: 'error'; message: string };

// Each entry: disc = avatar circle colour, badge = badge background colour.
// Member 0 = pink (MP "Sarah"), member 1 = cyan (MP "Yusuf"), etc.
const COLUMN_COLORS: Array<{ disc: string; badge: string }> = [
  { disc: 'bg-pink-300', badge: 'bg-pink-200' },
  { disc: 'bg-cyan-300', badge: 'bg-cyan-200' },
  { disc: 'bg-yellow-300', badge: 'bg-yellow-200' },
  { disc: 'bg-purple-300', badge: 'bg-purple-200' },
  { disc: 'bg-lime-300', badge: 'bg-lime-200' },
  { disc: 'bg-orange-300', badge: 'bg-orange-200' },
];

// Synthetic column key collecting tasks whose assigned member was
// removed: keeps them in one "Family" column rather than scattering.
const ORPHAN_KEY = '__family__';

function initials(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
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

export function TasksTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const togglingRef = useRef<Set<string>>(new Set());
  const deletingRef = useRef<Set<string>>(new Set());
  // Mirror the rendered tasks so an optimistic toggle captures the prior
  // row synchronously instead of racing the network in its setState.
  const tasksRef = useRef<Task[]>([]);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [tRes, mRes] = await Promise.all([
          fetch(`${API_BASE}/api/tasks`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!tRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load tasks (server returned ${tRes.status})`,
          });
          return;
        }
        const tBody = (await tRes.json()) as { tasks: Task[]; callerMemberId: string };
        let members: MemberLite[] = [];
        if (mRes.ok) members = ((await mRes.json()) as { members: MemberLite[] }).members ?? [];
        const nextTasks = tBody.tasks ?? [];
        tasksRef.current = nextTasks;
        setStatus({
          kind: 'ready',
          tasks: nextTasks,
          members,
          callerMemberId: tBody.callerMemberId,
        });
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

  const onAddOpen = useCallback(() => {
    setAdding(true);
    setEditingId(null);
    setSaveError(null);
    setDraft({ title: '', dueDate: '' });
  }, []);

  const onAddCancel = useCallback(() => {
    setAdding(false);
    setEditingId(null);
    setSaveError(null);
    setDraft({ title: '', dueDate: '' });
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!headers || savingRef.current) return;
      const trimmed = draft.title.trim();
      if (!trimmed) {
        setSaveError('Title is required.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const url = editingId ? `${API_BASE}/api/tasks/${editingId}` : `${API_BASE}/api/tasks`;
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, dueDate: draft.dueDate || null }),
        });
        if (!res.ok) {
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
        setStatusAnnouncement(editingId ? `"${trimmed}" updated` : `Added task "${trimmed}"`);
        setErrorAnnouncement('');
        await load();
        // Do NOT call notifyDashboardStale for edits: title/due changes don't affect counts.
        if (!editingId) notifyDashboardStale();
        requestAnimationFrame(() => addButtonRef.current?.focus());
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, editingId, load],
  );

  const onToggleDone = useCallback(
    async (id: string, nextDone: boolean) => {
      if (!headers || togglingRef.current.has(id)) return;
      const priorRow = tasksRef.current.find((t) => t.id === id);
      if (!priorRow) return;
      const title = priorRow.title;
      togglingRef.current.add(id);
      // tasksRef is the synchronous source of truth so back-to-back
      // toggles on different rows each capture their own prior row and
      // compose, instead of racing a one-render-late effect.
      const optimistic = tasksRef.current.map((t) =>
        t.id === id
          ? { ...t, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null }
          : t,
      );
      tasksRef.current = optimistic;
      setStatus((s) => (s.kind === 'ready' ? { ...s, tasks: optimistic } : s));
      const revert = () => {
        const reverted = tasksRef.current.map((t) => (t.id === id ? priorRow : t));
        tasksRef.current = reverted;
        setStatus((s) => (s.kind === 'ready' ? { ...s, tasks: reverted } : s));
      };
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: nextDone }),
        });
        if (!res.ok) {
          revert();
          setErrorAnnouncement(`Couldn't update task (server returned ${res.status})`);
        } else {
          setStatusAnnouncement(
            nextDone ? `Marked "${title}" done` : `Moved "${title}" back to to-do`,
          );
          setErrorAnnouncement('');
          notifyDashboardStale();
        }
      } catch {
        revert();
        setErrorAnnouncement("Network error. Couldn't update task.");
      } finally {
        togglingRef.current.delete(id);
      }
    },
    [headers],
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!headers || deletingRef.current.has(id)) return;
      deletingRef.current.add(id);
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE', headers });
        if (!res.ok) {
          setErrorAnnouncement(`Couldn't delete task (server returned ${res.status})`);
          return;
        }
        setStatusAnnouncement('Task deleted');
        setErrorAnnouncement('');
        await load();
        notifyDashboardStale();
      } catch (err) {
        setErrorAnnouncement(
          err instanceof Error ? err.message : "Network error. Couldn't delete task.",
        );
      } finally {
        deletingRef.current.delete(id);
      }
    },
    [headers, load],
  );

  const onEditClick = useCallback((t: Task) => {
    setSaveError(null);
    setEditingId(t.id);
    setAdding(true);
    setDraft({ title: t.title, dueDate: t.dueDate ?? '' });
  }, []);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="tasks-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading tasks…
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p data-testid="tasks-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const { tasks, members, callerMemberId } = status;

  // One column per member who has tasks, plus the caller (so they can
  // always add). Caller's column floats first. Unknown assignees (a
  // member removed after a task was created) collapse into "Family".
  const memberById = new Map(members.map((m) => [m.id, m]));
  // Bucket by column. The caller's own tasks always stay in the caller
  // column (even if /api/members failed to load); tasks whose member was
  // removed collapse into a single "Family" column.
  const byColumn = new Map<string, Task[]>();
  for (const t of tasks) {
    const key =
      t.memberId === callerMemberId || memberById.has(t.memberId) ? t.memberId : ORPHAN_KEY;
    const arr = byColumn.get(key);
    if (arr) arr.push(t);
    else byColumn.set(key, [t]);
  }
  const otherMemberIds = [...byColumn.keys()]
    .filter((k) => k !== callerMemberId && k !== ORPHAN_KEY)
    .sort((a, b) =>
      (memberById.get(a)?.displayName ?? '').localeCompare(memberById.get(b)?.displayName ?? ''),
    );
  // Caller first, then other members alphabetically, then orphans last.
  const orderedColumnIds = [
    callerMemberId,
    ...otherMemberIds,
    ...(byColumn.has(ORPHAN_KEY) ? [ORPHAN_KEY] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="tasks-ready">
      <div className="flex justify-between items-end mb-4">
        <h2 className="font-heading text-2xl tracking-wide text-white">My Tasks</h2>
      </div>

      <p aria-live="polite" className="sr-only" data-testid="tasks-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="tasks-error-announcement"
      >
        {errorAnnouncement}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="tasks-board">
        {orderedColumnIds.map((memberId, i) => {
          const member = memberId === ORPHAN_KEY ? undefined : memberById.get(memberId);
          const colTasks = byColumn.get(memberId) ?? [];
          const doneCount = colTasks.filter((t) => t.done).length;
          const isOwn = memberId === callerMemberId;
          return (
            <TaskColumn
              key={memberId}
              memberId={memberId}
              name={member?.displayName ?? 'Family'}
              color={COLUMN_COLORS[i % COLUMN_COLORS.length] ?? COLUMN_COLORS[0]!}
              tasks={colTasks}
              doneCount={doneCount}
              isOwn={isOwn}
              onToggle={onToggleDone}
              onDelete={onDelete}
              onEdit={onEditClick}
              adding={isOwn && adding}
              editingId={isOwn ? editingId : null}
              addButtonRef={isOwn ? addButtonRef : undefined}
              onAddOpen={onAddOpen}
              onAddCancel={onAddCancel}
              onAddSubmit={onAddSubmit}
              draft={draft}
              setDraft={setDraft}
              saving={saving}
              saveError={saveError}
            />
          );
        })}
      </div>
    </div>
  );
}

function TaskColumn(props: {
  memberId: string;
  name: string;
  color: { disc: string; badge: string };
  tasks: Task[];
  doneCount: number;
  isOwn: boolean;
  onToggle: (id: string, nextDone: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (t: Task) => void;
  adding: boolean;
  editingId: string | null;
  addButtonRef: React.RefObject<HTMLButtonElement> | undefined;
  onAddOpen: () => void;
  onAddCancel: () => void;
  onAddSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  draft: { title: string; dueDate: string };
  setDraft: (d: { title: string; dueDate: string }) => void;
  saving: boolean;
  saveError: string | null;
}) {
  const {
    memberId,
    name,
    color,
    tasks,
    doneCount,
    isOwn,
    onToggle,
    onDelete,
    onEdit,
    adding,
    editingId,
    addButtonRef,
    onAddOpen,
    onAddCancel,
    onAddSubmit,
    draft,
    setDraft,
    saving,
    saveError,
  } = props;

  return (
    <section
      data-testid={`tasks-column-${memberId}`}
      aria-labelledby={`tasks-column-name-${memberId}`}
      className="flex flex-col gap-3 rounded-xl border-2 border-black p-4 shadow-neo-sm bg-white"
    >
      <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-heading text-lg shadow-neo-xs ${color.disc}`}
          >
            {initials(name)}
          </span>
          <h3
            id={`tasks-column-name-${memberId}`}
            data-testid={`tasks-column-name-${memberId}`}
            className="font-heading text-xl text-black"
          >
            {name}
            {isOwn && <span className="ml-1 text-xs font-bold text-gray-500">(you)</span>}
          </h3>
        </div>
        <span
          data-testid={`tasks-column-badge-${memberId}`}
          aria-label={`${doneCount} of ${tasks.length} done`}
          className={`inline-flex rounded-full border-2 border-black px-3 py-0.5 text-xs font-bold text-black ${color.badge}`}
        >
          {doneCount}/{tasks.length} Done
        </span>
      </div>

      {tasks.length === 0 && !adding ? (
        <p
          data-testid={`tasks-column-empty-${memberId}`}
          className="py-3 text-center text-sm font-bold text-gray-500"
        >
          {isOwn ? 'Nothing yet. Add your first task.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="space-y-3 mb-6" data-testid={`tasks-column-list-${memberId}`}>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              editable={isOwn}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}

      {isOwn &&
        (adding ? (
          <form
            onSubmit={onAddSubmit}
            className="flex flex-col gap-2 rounded-md border-2 border-black bg-white p-3"
            data-testid="tasks-add-form"
            aria-label={editingId ? 'Edit task' : 'Add task'}
          >
            <p className="text-xs font-bold text-black">{editingId ? 'Edit task' : 'Add task'}</p>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Title
              <input
                type="text"
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="tasks-add-title"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Due date (optional)
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                data-testid="tasks-add-due"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="tasks-add-error"
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
                testId="tasks-add-submit"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="tasks-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            ref={addButtonRef}
            variant="secondary"
            fullWidth
            testId="tasks-add"
            onClick={onAddOpen}
            className="mt-auto border-dashed !border-gray-400 text-gray-500 hover:text-black hover:!border-black hover:bg-gray-50 gap-2"
          >
            <Plus size={18} aria-hidden="true" /> Add Task
          </Button>
        ))}
    </section>
  );
}

function TaskRow({
  task,
  editable,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  editable: boolean;
  onToggle: (id: string, nextDone: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (t: Task) => void;
}) {
  return (
    <li data-testid={`task-row-${task.id}`}>
      <div
        className={`flex items-center justify-between p-3 border-2 border-black rounded-lg shadow-neo-xs motion-safe:transition-colors ${
          task.done ? 'bg-gray-100 opacity-70' : 'bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {editable ? (
            <button
              type="button"
              onClick={() => onToggle(task.id, !task.done)}
              aria-label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
              data-testid={`task-toggle-${task.id}`}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              {task.done ? (
                <CheckCircle2 size={20} className="fill-green-400" />
              ) : (
                <Circle size={20} />
              )}
            </button>
          ) : (
            <span aria-hidden="true" className="shrink-0 text-gray-500">
              {task.done ? (
                <CheckCircle2 size={20} className="fill-green-300" />
              ) : (
                <Circle size={20} />
              )}
            </span>
          )}
          <div className="min-w-0">
            <p
              className={`font-bold text-sm text-black ${task.done ? 'line-through text-gray-500' : ''}`}
              data-testid={`task-title-${task.id}`}
            >
              {task.title}
            </p>
            <span
              className="flex items-center gap-1 text-xs font-bold text-red-500"
              data-testid={`task-due-${task.id}`}
            >
              <Clock size={11} aria-hidden="true" /> {formatDueDate(task.dueDate)}
            </span>
          </div>
        </div>
        {editable && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(task)}
              aria-label={`Edit task: ${task.title.slice(0, 40)}`}
              data-testid={`task-edit-${task.id}`}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded border-2 border-black/20 bg-white text-gray-500 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:border-black hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              aria-label={`Delete task: ${task.title.slice(0, 40)}`}
              data-testid={`task-delete-${task.id}`}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-gray-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
