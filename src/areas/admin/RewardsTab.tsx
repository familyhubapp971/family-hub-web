import { useCallback, useEffect, useState } from 'react';
import { Gift, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Card, ConfirmDialog } from '@familyhub/ui';
import { API_BASE } from '../../app/lib/api';

/**
 * RewardsTab: FHS-483
 *
 * Lets a parent (admin) add, edit, and remove the family's reward-shop
 * catalogue from the Admin Panel. Server-side every mutation is admin-only
 * and tenant-scoped (POST/PATCH/DELETE /api/rewards[/:id]); this tab is
 * reachable at all only because AdminPanelPage already redirects any
 * non-admin caller away from the whole panel before this renders.
 *
 * Listing reuses the existing GET /api/rewards?memberId=<id> endpoint (built
 * for the kid Rewards Shop) instead of adding a 4th endpoint: that route
 * already returns every non-archived reward for the tenant; memberId there
 * is only used to check the caller is a family member and to compute a
 * sticker balance this tab doesn't need, so any member id in the tenant
 * works. `/api/members` always has at least one row (the admin themself),
 * so this works even before any child has been added.
 *
 * Delete is a soft-delete server-side (archived_at): past redemptions keep
 * their record. The UI just calls DELETE; the "gone forever" framing in the
 * confirm dialog talks about the shop, not the data.
 */

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}

interface RewardForm {
  name: string;
  description: string;
  stickerCost: string;
  icon: string;
}

const EMPTY_FORM: RewardForm = { name: '', description: '', stickerCost: '', icon: '' };

function toForm(r: RewardItem): RewardForm {
  return {
    name: r.name,
    description: r.description ?? '',
    stickerCost: String(r.stickerCost),
    icon: r.icon ?? '',
  };
}

/** Mirrors the API's Zod validation so the error surfaces before the round trip. */
function formError(form: RewardForm): string | null {
  if (form.name.trim().length === 0) return 'Reward name is required.';
  const cost = Number(form.stickerCost);
  if (!Number.isInteger(cost) || cost < 1) {
    return 'Sticker cost must be a whole number, 1 or more.';
  }
  return null;
}

function toPayload(form: RewardForm) {
  return {
    name: form.name.trim(),
    description: form.description.trim() === '' ? null : form.description.trim(),
    stickerCost: Number(form.stickerCost),
    icon: form.icon.trim() === '' ? null : form.icon.trim(),
  };
}

export function RewardsTab({ headers }: { headers: Record<string, string> | null }) {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<RewardForm>(EMPTY_FORM);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RewardForm>(EMPTY_FORM);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RewardItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const membersRes = await fetch(`${API_BASE}/api/members`, { headers });
      if (!membersRes.ok) throw new Error(`Members fetch failed: ${membersRes.status}`);
      const membersBody = (await membersRes.json()) as { members?: { id: string }[] };
      const probeId = membersBody.members?.[0]?.id;
      if (!probeId) {
        setRewards([]);
        return;
      }
      const res = await fetch(`${API_BASE}/api/rewards?memberId=${probeId}`, { headers });
      if (!res.ok) throw new Error(`Rewards fetch failed: ${res.status}`);
      const body = (await res.json()) as { rewards?: RewardItem[] };
      setRewards(body.rewards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void fetchRewards();
  }, [fetchRewards]);

  const handleAdd = async () => {
    if (!headers) return;
    const validation = formError(addForm);
    if (validation) {
      setAddError(validation);
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(addForm)),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      setAddForm(EMPTY_FORM);
      setAdding(false);
      await fetchRewards();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add reward');
    } finally {
      setAddBusy(false);
    }
  };

  const startEdit = (r: RewardItem) => {
    setEditingId(r.id);
    setEditForm(toForm(r));
    setEditError(null);
  };

  const handleEditSave = async (id: string) => {
    if (!headers) return;
    const validation = formError(editForm);
    if (validation) {
      setEditError(validation);
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(editForm)),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      setEditingId(null);
      await fetchRewards();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update reward');
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!headers || !deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setDeleteTarget(null);
      await fetchRewards();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to remove reward');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-rewards-loading" className="text-sm text-purple-200">
        Loading rewards…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-rewards-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  return (
    <div
      data-testid="admin-rewards-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-pink-500 p-2.5 rounded-xl text-white shadow-sm">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Reward Shop</h3>
            <p className="text-sm text-pink-300 font-medium">What kids can spend stickers on</p>
          </div>
        </div>
        {!adding && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setAddForm(EMPTY_FORM);
              setAddError(null);
              setAdding(true);
            }}
            testId="admin-rewards-add-btn"
          >
            <Plus className="w-4 h-4" />
            <span className="ml-1">Add reward</span>
          </Button>
        )}
      </div>

      {adding && (
        <RewardFormCard
          testId="admin-rewards-add-form"
          heading="Add reward"
          form={addForm}
          onChange={setAddForm}
          busy={addBusy}
          error={addError}
          onSave={() => void handleAdd()}
          onCancel={() => setAdding(false)}
          saveLabel="Add reward"
        />
      )}

      {rewards.length === 0 && !adding && (
        <p data-testid="admin-rewards-empty" className="text-sm text-purple-200">
          No rewards yet. Add one so kids have something to spend stickers on.
        </p>
      )}

      <ul className="space-y-3" data-testid="admin-rewards-list">
        {rewards.map((r) => (
          <li key={r.id} data-testid={`admin-rewards-row-${r.id}`} className="list-none">
            {editingId === r.id ? (
              <RewardFormCard
                testId={`admin-rewards-edit-form-${r.id}`}
                heading="Edit reward"
                form={editForm}
                onChange={setEditForm}
                busy={editBusy}
                error={editError}
                onSave={() => void handleEditSave(r.id)}
                onCancel={() => setEditingId(null)}
                saveLabel="Save changes"
              />
            ) : (
              <Card className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-100 text-xl"
                  >
                    {r.icon ?? '🎁'}
                  </span>
                  <div className="min-w-0">
                    <p
                      data-testid={`admin-rewards-row-${r.id}-name`}
                      className="truncate font-bold text-gray-900"
                    >
                      {r.name}
                    </p>
                    {r.description && (
                      <p className="truncate text-xs text-gray-500">{r.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    data-testid={`admin-rewards-row-${r.id}-cost`}
                    className="whitespace-nowrap rounded-lg border-2 border-black bg-yellow-400 px-2 py-1 text-xs font-black"
                  >
                    {r.stickerCost}⭐
                  </span>
                  <button
                    type="button"
                    data-testid={`admin-rewards-row-${r.id}-edit-btn`}
                    onClick={() => startEdit(r)}
                    aria-label={`Edit ${r.name}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 border-gray-200 text-gray-600 transition-colors hover:border-black"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    data-testid={`admin-rewards-row-${r.id}-delete-btn`}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(r);
                    }}
                    aria-label={`Remove ${r.name}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 border-gray-200 text-red-600 transition-colors hover:border-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        variant="danger"
        title="Remove this reward?"
        message={
          deleteTarget ? (
            <>
              <strong>{deleteTarget.name}</strong> will no longer show up in the reward shop. Past
              redemptions stay on record.
            </>
          ) : undefined
        }
        confirmLabel="Remove"
        busy={deleteBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        testId="admin-rewards-delete-confirm"
      >
        {deleteError && (
          <p
            data-testid="admin-rewards-delete-error"
            className="mt-2 text-sm font-bold text-red-600"
          >
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function RewardFormCard({
  testId,
  heading,
  form,
  onChange,
  busy,
  error,
  onSave,
  onCancel,
  saveLabel,
}: {
  testId: string;
  heading: string;
  form: RewardForm;
  onChange: (f: RewardForm) => void;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <Card className="space-y-4 p-4 sm:p-5" testId={testId}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-wide text-gray-900">{heading}</h4>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 transition-colors hover:text-black"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem]">
        <div>
          <label
            htmlFor={`${testId}-name`}
            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500"
          >
            Reward name
          </label>
          <input
            id={`${testId}-name`}
            type="text"
            value={form.name}
            maxLength={120}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            data-testid={`${testId}-name`}
            placeholder="e.g. Movie night"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 font-medium text-gray-900 outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label
            htmlFor={`${testId}-icon`}
            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500"
          >
            Icon
          </label>
          <input
            id={`${testId}-icon`}
            type="text"
            value={form.icon}
            maxLength={8}
            onChange={(e) => onChange({ ...form, icon: e.target.value })}
            data-testid={`${testId}-icon`}
            placeholder="🎬"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-center text-xl font-medium text-gray-900 outline-none focus:border-orange-400"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`${testId}-description`}
          className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500"
        >
          Description (optional)
        </label>
        <input
          id={`${testId}-description`}
          type="text"
          value={form.description}
          maxLength={500}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          data-testid={`${testId}-description`}
          placeholder="e.g. Pick the family film"
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 font-medium text-gray-900 outline-none focus:border-orange-400"
        />
      </div>
      <div>
        <label
          htmlFor={`${testId}-cost`}
          className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500"
        >
          Sticker cost
        </label>
        <input
          id={`${testId}-cost`}
          type="number"
          min={1}
          step={1}
          value={form.stickerCost}
          onChange={(e) => onChange({ ...form, stickerCost: e.target.value })}
          data-testid={`${testId}-cost`}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 font-medium text-gray-900 outline-none focus:border-orange-400"
        />
      </div>
      {error && (
        <p data-testid={`${testId}-error`} className="text-sm font-bold text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <Button
          variant="primary"
          size="md"
          disabled={busy}
          onClick={onSave}
          testId={`${testId}-save`}
        >
          {busy ? 'Saving…' : saveLabel}
        </Button>
        <Button variant="secondary" size="md" onClick={onCancel} testId={`${testId}-cancel`}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
