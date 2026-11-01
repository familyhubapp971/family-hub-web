import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Gift, Star } from 'lucide-react';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-379: parent "Reward Requests" approval screen. Restyled to the
// Magic Patterns neo-brutalist spec. Non-admins see a muted note in
// place of the action buttons; admins get a two-step confirm flow for
// Decline.
// FHS-392: accepts an optional `memberId` prop. When provided, only
// that child's pending requests are shown (used in ChildWorldPage
// sidebar). When omitted, all pending requests are listed.

interface RequestItem {
  id: string;
  memberId: string;
  memberName: string;
  rewardId: string;
  rewardName: string;
  rewardIcon: string | null;
  starCost: number;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
}

// Deterministic pastel disc colour keyed on memberId so the same child
// always lands on the same colour across reloads.
const CHILD_COLORS = [
  'bg-purple-300',
  'bg-yellow-300',
  'bg-pink-300',
  'bg-cyan-300',
  'bg-green-300',
];
function childColor(memberId: string): string {
  const hash = [...memberId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CHILD_COLORS[hash % CHILD_COLORS.length] ?? 'bg-purple-300';
}

// Relative-time helper: "just now" / "N mins ago" / "N hrs ago" / "N days ago"
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function RewardRequestsPanel({ memberId }: { memberId?: string } = {}) {
  const { session } = useAuth();
  const slug = useTenantSlug();
  const accessToken = session?.access_token ?? null;
  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': slug } : null),
    [accessToken, slug],
  );

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  // Two-step decline: holds the id currently in the "confirm?" state.
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/members`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((b: { callerRole?: string }) => setIsAdmin(b.callerRole === 'admin'))
      .catch(() => {});
    fetch(`${API_BASE}/api/mw/redemption-requests?status=pending`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((b: { requests?: RequestItem[] }) => {
        const all = b.requests ?? [];
        setRequests(memberId ? all.filter((r) => r.memberId === memberId) : all);
      })
      .catch(() => {});
    return () => ac.abort();
    // memberId is in the filter: re-run if the viewed child changes without unmount.
  }, [headers, memberId]);

  const decide = useCallback(
    async (id: string, action: 'approve' | 'decline') => {
      if (!headers || busyId) return;
      setBusyId(id);
      setRowError(null);
      try {
        const res = await fetch(`${API_BASE}/api/mw/redemption-requests/${id}/${action}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
        if (res.ok || res.status === 409) {
          // 409 = already decided by someone else; drop it either way.
          setRequests((prev) => prev.filter((r) => r.id !== id));
          setDecliningId(null);
          return;
        }
        if (res.status === 400) {
          setRowError({ id, msg: 'Not enough savings to approve yet.' });
          return;
        }
        setRowError({ id, msg: "Couldn't update. Try again." });
      } catch {
        setRowError({ id, msg: "Couldn't update. Try again." });
      } finally {
        setBusyId(null);
      }
    },
    [headers, busyId],
  );

  const pendingCount = requests.length;
  // FHS-408: in single-child mode this panel sits in a NARROW sidebar, so the
  // 12-col grid crams (cost/time/buttons + helper text overlap). Stack instead.
  const singleChild = Boolean(memberId);

  return (
    <section
      data-testid="reward-requests-panel"
      aria-labelledby="reward-requests-heading"
      className="space-y-6"
    >
      {/* Heading row */}
      <h2
        id="reward-requests-heading"
        className="flex flex-wrap items-center gap-3 font-heading text-2xl tracking-wide text-white"
      >
        <Gift className="text-pink-400" aria-hidden="true" />
        Reward Requests
        <span
          data-testid="reward-requests-count"
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-bold text-white"
        >
          {pendingCount} Pending
        </span>
      </h2>

      {/* Empty state */}
      {pendingCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-black bg-white p-12 text-center shadow-neo-sm">
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-gray-100 text-4xl shadow-neo-xs"
            aria-hidden="true"
          >
            🎉
          </div>
          <h3 className="mb-2 font-heading text-2xl">All caught up!</h3>
          <p className="font-bold text-gray-500">There are no pending reward requests right now.</p>
        </div>
      ) : (
        /* List card */
        <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm">
          {/* Desktop column header: only in the wide multi-child grid layout */}
          {!singleChild && (
            <div
              className="hidden gap-4 border-b-2 border-black bg-gray-50 p-4 text-xs font-bold uppercase tracking-widest text-gray-500 md:grid md:grid-cols-12"
              aria-hidden="true"
            >
              <span className="col-span-4">Child &amp; Reward</span>
              <span className="col-span-2 text-center">Cost</span>
              <span className="col-span-2 text-center">Requested</span>
              <span className="col-span-4 text-right">Actions</span>
            </div>
          )}

          {/* Rows */}
          <ul className="divide-y-2 divide-black">
            {requests.map((r) => {
              const initial = r.memberName.charAt(0).toUpperCase();
              const color = childColor(r.memberId);
              const isDeclinePending = decliningId === r.id;

              return (
                <li
                  key={r.id}
                  data-testid={`reward-request-${r.id}`}
                  className={`flex flex-col gap-4 p-4 transition-colors hover:bg-gray-50 md:p-5 ${
                    singleChild ? '' : 'md:grid md:grid-cols-12 md:items-center'
                  }`}
                  aria-label={`${r.memberName} wants ${r.rewardName}`}
                >
                  {/* Child & Reward */}
                  <div className="col-span-4 flex items-center gap-4">
                    {/* Avatar disc: hidden in single-child mode (memberId set) */}
                    {!memberId && (
                      <span
                        aria-hidden="true"
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black font-heading text-xl shadow-neo-xs ${color}`}
                      >
                        {initial}
                      </span>
                    )}
                    <div className="min-w-0">
                      {!memberId && (
                        <p className="mb-0.5 text-sm font-bold text-gray-500">
                          {r.memberName} wants&hellip;
                        </p>
                      )}
                      <p className="font-heading text-xl">
                        {r.rewardIcon ? `${r.rewardIcon} ` : ''}
                        {r.rewardName}
                      </p>
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="col-span-2 flex items-center gap-2 md:justify-center">
                    <span
                      className={`text-sm font-bold text-gray-500 ${singleChild ? '' : 'md:hidden'}`}
                    >
                      Cost:
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full border-2 border-black bg-yellow-100 px-3 py-1 shadow-neo-xs">
                      <span className="font-heading text-lg text-yellow-700">{r.starCost}</span>
                      <Star
                        size={14}
                        className="fill-yellow-400 text-yellow-500"
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  {/* Requested */}
                  <div className="col-span-2 flex items-center gap-2 md:justify-center">
                    <span
                      className={`text-sm font-bold text-gray-500 ${singleChild ? '' : 'md:hidden'}`}
                    >
                      Requested:
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-gray-400">
                      <Clock size={14} aria-hidden="true" />
                      {relativeTime(r.requestedAt)}
                    </span>
                  </div>

                  {/* Actions (col-span-4) */}
                  <div className="col-span-4 flex flex-col gap-1">
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 md:mt-0">
                      {isAdmin ? (
                        isDeclinePending ? (
                          // Two-step decline: confirm state
                          <>
                            <button
                              type="button"
                              onClick={() => setDecliningId(null)}
                              disabled={busyId === r.id}
                              aria-label={`Cancel decline of ${r.rewardName}`}
                              className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:border-black hover:bg-gray-50 disabled:opacity-50 min-h-[44px] md:flex-none"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              data-testid={`reward-request-confirm-decline-${r.id}`}
                              onClick={() => void decide(r.id, 'decline')}
                              disabled={busyId === r.id}
                              aria-label={`Confirm declining ${r.rewardName} for ${r.memberName}`}
                              className="flex-1 rounded-lg border-2 border-black bg-red-400 px-4 py-2 text-sm font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5 disabled:opacity-50 min-h-[44px] md:flex-none"
                            >
                              {busyId === r.id ? 'Declining…' : 'Confirm Decline'}
                            </button>
                          </>
                        ) : (
                          // Default: Decline + Approve
                          <>
                            <button
                              type="button"
                              data-testid={`reward-request-decline-${r.id}`}
                              onClick={() => setDecliningId(r.id)}
                              disabled={busyId === r.id}
                              aria-label={`Decline ${r.rewardName} for ${r.memberName}`}
                              className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:border-black hover:bg-gray-50 disabled:opacity-50 min-h-[44px] md:flex-none"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              data-testid={`reward-request-approve-${r.id}`}
                              onClick={() => void decide(r.id, 'approve')}
                              disabled={busyId === r.id}
                              aria-label={`Approve ${r.rewardName} for ${r.memberName}`}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-black bg-green-400 px-4 py-2 text-sm font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5 disabled:opacity-50 min-h-[44px] md:flex-none"
                            >
                              <Check size={16} strokeWidth={3} aria-hidden="true" />
                              {busyId === r.id ? 'Approving…' : 'Approve'}
                            </button>
                          </>
                        )
                      ) : (
                        <p
                          className="text-sm font-bold text-gray-400"
                          data-testid="reward-requests-readonly"
                        >
                          Only an admin can approve
                        </p>
                      )}
                    </div>

                    {/* Inline error (400 INSUFFICIENT_SAVINGS) */}
                    {rowError?.id === r.id && (
                      <p
                        data-testid={`reward-request-error-${r.id}`}
                        className="text-right text-xs font-bold text-red-500"
                        role="alert"
                      >
                        {rowError.msg}
                      </p>
                    )}

                    {/* Helper hint: admins only (it's about approving), not while
                        in decline confirm. FHS-408: also gate on isAdmin so the
                        non-admin sidebar doesn't show "Approving will deduct…". */}
                    {isAdmin && !isDeclinePending && (
                      <p
                        className={`mt-1 text-right text-[10px] font-bold text-gray-400 ${
                          singleChild ? 'block' : 'hidden md:block'
                        }`}
                      >
                        Approving will deduct {r.starCost} stars from {r.memberName}&apos;s balance.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
