import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Edit2,
  Key,
  Mail,
  Plus,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  AvatarDisc,
  Button,
  Card,
  CollapsibleSection,
  FormCard,
  Input,
  Label,
  MemberCard,
  RoleBadge,
} from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { AppHeader } from '../../app/layout/AppHeader';
import { DEFAULT_TAB } from '../../app/layout/dashboard-tabs';
import { isKidRole, isPinEligibleRole } from '@familyhub/shared';

// FHS-513: Manage Family rebuild to the finalised Magic Patterns
// design: a family-name header with a "{N} members · {M} waiting to
// join" summary and two CTAs ("Invite an adult" / "Add a child"),
// members split into two collapsible groups ("Grown-ups": sign in
// with email; "Kids": sign in with a PIN), a collapsible "How your
// kids sign in" helper card, and a separate "Waiting to join" section
// for unclaimed grown-up seats.
//
// This is a VISUAL/STRUCTURAL rebuild only: every existing API call,
// admin-only mutation gate, and last-admin protection carries over
// unchanged from the pre-FHS-513 page (FHS-108 / FHS-252 / FHS-276 /
// FHS-471/472/473 / FHS-486). See each handler below for its history.
//
// "Change email" (FHS-510) is self-serve: the button renders ONLY on the
// caller's own grown-up card and starts a confirm-by-email change of their
// own sign-in address (a member can never change another member's email).

interface MemberItem {
  id: string;
  displayName: string;
  role: 'admin' | 'adult' | 'teen' | 'child' | 'guest' | string;
  avatarEmoji: string | null;
  status: 'active' | 'unclaimed';
  createdAt: string;
  isChild: boolean;
  hasPin: boolean;
  age: number | null;
  inviteEmail: string | null;
  inviteId: string | null;
  // FHS-510: the grown-up's current sign-in email (null for kids and
  // unclaimed seats), and any new email awaiting confirmation.
  email: string | null;
  pendingEmail: string | null;
}

interface ListMembersResponse {
  members: MemberItem[];
  callerRole: string;
  callerMemberId: string;
}

interface MeResponseTenant {
  slug: string;
  name: string;
  role: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; members: MemberItem[]; callerRole: string; callerMemberId: string }
  | { kind: 'error'; message: string };

const GROWN_UP_ROLES = new Set(['admin', 'adult', 'guest']);
const ADMIN_OR_ADULT = new Set(['admin', 'adult']);

// FHS-521: show the family name as "The {Name} Family" to match the design
// (tenant name "Khan" → "The Khan Family"). If the stored name already reads
// like a family name (contains "family"), show it verbatim; empty → neutral.
function familyTitle(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return 'Your family';
  if (/\bfamily\b/i.test(n)) return n;
  const titled = n.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return `The ${titled} Family`;
}

// FHR-31: action buttons on member cards share a row on phones.
const MEMBER_ACTION_BTN =
  'flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-black bg-white px-3 text-sm font-bold text-black transition-colors hover:bg-gray-50 sm:flex-none sm:px-4';

export function MembersPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [familyName, setFamilyName] = useState<string | null>(null);

  // FHS-322: render the shared app header; nav tabs route to the dashboard.
  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  // Which header form is open. ?add=member still opens the "Add a child"
  // form for any entry point that deep-links here with it (FHS-471/501):
  // the Family Overview button (FHS-520) now just links to this page plain.
  const [activeForm, setActiveForm] = useState<'none' | 'invite' | 'child'>(
    params.get('add') === 'member' ? 'child' : 'none',
  );
  const [openPinFor, setOpenPinFor] = useState<string | null>(null);
  const [editingFor, setEditingFor] = useState<string | null>(null);
  // FHS-510: which grown-up's "New email for …" inline form is open.
  const [emailChangeFor, setEmailChangeFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const authedHeaders = session
    ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug }
    : null;

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/members`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
      });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load members (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListMembersResponse;
      setStatus({
        kind: 'ready',
        members: body.members,
        callerRole: body.callerRole,
        callerMemberId: body.callerMemberId,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error. Try again.',
      });
    }
  }, [session, slug]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  // Family name for the header: same /api/me lookup AppHeader already
  // does. Best-effort: on failure the heading falls back to "Your family".
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { tenants?: MeResponseTenant[] } | null) => {
        if (cancelled || !me?.tenants) return;
        const tenant = me.tenants.find((t) => t.slug === slug);
        if (tenant) setFamilyName(tenant.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  // Shared mutation helper: fires, surfaces the server's `detail` on
  // failure, refreshes the list on success.
  const mutate = useCallback(
    async (path: string, init: RequestInit): Promise<boolean> => {
      if (!authedHeaders) return false;
      setActionError(null);
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers: { ...authedHeaders, 'Content-Type': 'application/json', ...init.headers },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
          setActionError(body.detail ?? body.error ?? `Server returned ${res.status}`);
          return false;
        }
        await fetchMembers();
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Network error. Try again.');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedHeaders derives from session+slug
    [session, slug, fetchMembers],
  );

  const ready = status.kind === 'ready';
  const callerIsAdmin = ready && status.callerRole === 'admin';
  // FHS-510: the caller's own member id, so a grown-up can change THEIR OWN
  // sign-in email (self-serve) from their own card, admin or not.
  const callerMemberId = ready ? status.callerMemberId : null;
  const allMembers = ready ? status.members : [];
  const adminCount = allMembers.filter((m) => m.role === 'admin').length;

  // Grown-ups actually signed in vs still waiting on their invite; kids
  // are never "waiting" (PIN login, no signup step): see FHS-276.
  const grownUps = allMembers.filter((m) => GROWN_UP_ROLES.has(m.role) && m.status === 'active');
  const waiting = allMembers.filter((m) => GROWN_UP_ROLES.has(m.role) && m.status !== 'active');
  const kids = allMembers.filter((m) => isKidRole(m.role));
  const memberCount = grownUps.length + kids.length;

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900">
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <div className="mb-2">
          <Link
            to={`/t/${slug}/dashboard`}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-purple-200 hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </Link>
        </div>
        <div className="mb-6 mt-1 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1
              className="font-heading text-3xl text-white sm:text-4xl"
              data-testid="members-family-name"
            >
              {familyTitle(familyName)}
            </h1>
            <p className="mt-1 text-sm font-bold text-purple-200" data-testid="members-summary">
              {memberCount} member{memberCount === 1 ? '' : 's'} · {waiting.length} waiting to join
            </p>
          </div>
          {callerIsAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                testId="members-invite-adult"
                onClick={() => setActiveForm((f) => (f === 'invite' ? 'none' : 'invite'))}
              >
                <Mail size={16} aria-hidden="true" /> Invite an adult
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                testId="members-add-child"
                onClick={() => setActiveForm((f) => (f === 'child' ? 'none' : 'child'))}
              >
                <Plus size={16} aria-hidden="true" /> Add a child
              </Button>
            </div>
          )}
        </div>

        {activeForm === 'invite' && callerIsAdmin && (
          <InviteAdultForm
            callerIsAdmin={callerIsAdmin}
            onClose={() => setActiveForm('none')}
            onSubmit={async (email, name, role) => {
              const ok = await mutate('/api/invitations', {
                method: 'POST',
                body: JSON.stringify({
                  email,
                  role,
                  ...(name ? { displayName: name } : {}),
                }),
              });
              if (ok) setActiveForm('none');
            }}
            error={actionError}
          />
        )}
        {activeForm === 'child' && callerIsAdmin && (
          <AddChildForm
            onClose={() => setActiveForm('none')}
            onSubmit={async (displayName, role) => {
              const ok = await mutate('/api/members', {
                method: 'POST',
                body: JSON.stringify({ displayName, role }),
              });
              if (ok) setActiveForm('none');
            }}
            error={actionError}
          />
        )}

        {status.kind === 'loading' && (
          <p data-testid="members-loading" className="text-sm font-bold text-purple-200">
            Loading members…
          </p>
        )}
        {status.kind === 'error' && (
          <p data-testid="members-error" role="alert" className="text-sm font-bold text-red-300">
            {status.message}
          </p>
        )}
        {ready && allMembers.length === 0 && (
          <p data-testid="members-empty" className="text-sm font-bold text-purple-200">
            Nobody here yet
          </p>
        )}

        {actionError && activeForm === 'none' && (
          <p
            data-testid="members-action-error"
            role="alert"
            className="mb-4 text-sm font-bold text-red-300"
          >
            {actionError}
          </p>
        )}

        {/* FHS-521: "How your kids sign in" sits above the member groups,
            matching the design's order (header/forms → kid-login → groups). */}
        {ready && (
          <div className="mb-6">
            <KidLoginHelp slug={slug} kidsCount={kids.length} />
          </div>
        )}

        {ready && allMembers.length > 0 && (
          <div className="space-y-6">
            {grownUps.length > 0 ? (
              <CollapsibleSection
                variant="group"
                defaultOpen={false}
                emoji="🧑🏽"
                title="Grown-ups"
                subtitle="Sign in with email"
                count={grownUps.length}
                headerClassName="bg-cyan-300 text-black"
                testId="members-group-grownups"
              >
                <ul
                  className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                  data-testid="members-grownups-list"
                >
                  {grownUps.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <GrownUpCard
                        member={m}
                        idx={idx}
                        callerIsAdmin={callerIsAdmin}
                        callerMemberId={callerMemberId}
                        adminCount={adminCount}
                        editingFor={editingFor}
                        setEditingFor={setEditingFor}
                        emailChangeFor={emailChangeFor}
                        setEmailChangeFor={setEmailChangeFor}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ) : (
              // FHS-519: a family can (briefly) have kids/waiting seats but
              // no active grown-up yet; show a placeholder instead of just
              // silently dropping the "Grown-ups" group from the page.
              <EmptyGroupPlaceholder
                testId="members-group-grownups-empty"
                emoji="🧑🏽"
                title="No grown-ups yet"
                hint={
                  callerIsAdmin
                    ? 'Tap "Invite an adult" above to bring one in.'
                    : 'Nobody has joined as a grown-up yet.'
                }
              />
            )}

            {kids.length > 0 ? (
              <CollapsibleSection
                variant="group"
                defaultOpen={false}
                emoji="🧒🏽"
                title="Kids"
                subtitle="Sign in with a PIN"
                count={kids.length}
                headerClassName="bg-yellow-300 text-black"
                testId="members-group-kids"
              >
                <ul
                  className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                  data-testid="members-kids-list"
                >
                  {kids.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <KidCard
                        member={m}
                        idx={idx}
                        callerRole={status.callerRole}
                        callerIsAdmin={callerIsAdmin}
                        editingFor={editingFor}
                        setEditingFor={setEditingFor}
                        openPinFor={openPinFor}
                        setOpenPinFor={setOpenPinFor}
                        slug={slug}
                        session={session}
                        fetchMembers={fetchMembers}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ) : (
              <EmptyGroupPlaceholder
                testId="members-group-kids-empty"
                emoji="🧒🏽"
                title="No kids yet"
                hint={
                  callerIsAdmin
                    ? 'Tap "Add a child" above to bring them into the family.'
                    : 'No kids in this family yet.'
                }
              />
            )}

            {waiting.length > 0 && (
              <Card testId="members-waiting-section" className="mt-2">
                <h2 className="mb-1 flex items-center gap-2 font-heading text-xl text-black">
                  <Send size={18} aria-hidden="true" /> Waiting to join
                </h2>
                <p className="mb-4 text-sm font-bold text-gray-500">
                  They have an email sign-in link that has not been used yet.
                </p>
                <ul className="space-y-3" data-testid="members-waiting-list">
                  {waiting.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <WaitingRow
                        member={m}
                        idx={idx}
                        callerIsAdmin={callerIsAdmin}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// FHS-519: stand-in for a member group ("Grown-ups" / "Kids") when it has
// no rows but the OTHER group (or the "Waiting to join" section) does, so
// the group isn't just silently missing from the page. Styled to sit next
// to the dark `CollapsibleSection variant="group"` cards it replaces.
function EmptyGroupPlaceholder({
  testId,
  emoji,
  title,
  hint,
}: {
  testId: string;
  emoji: string;
  title: string;
  hint: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-white/40 bg-black/10 p-4"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white text-xl shadow-neo-xs"
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-lg text-white">{title}</p>
        <p className="text-sm font-bold text-purple-200">{hint}</p>
      </div>
    </div>
  );
}

// ── Grown-ups group card ────────────────────────────────────────────────────

interface GrownUpCardProps {
  member: MemberItem;
  idx: number;
  callerIsAdmin: boolean;
  callerMemberId: string | null;
  adminCount: number;
  editingFor: string | null;
  setEditingFor: (id: string | null) => void;
  emailChangeFor: string | null;
  setEmailChangeFor: (id: string | null) => void;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function GrownUpCard({
  member: m,
  idx,
  callerIsAdmin,
  callerMemberId,
  adminCount,
  editingFor,
  setEditingFor,
  emailChangeFor,
  setEmailChangeFor,
  mutate,
}: GrownUpCardProps) {
  const isParentRow = m.role === 'admin' || m.role === 'adult';
  const lastAdminLock = m.role === 'admin' && adminCount <= 1;
  const testId = `members-grownup-${idx}`;

  const isAdminRole = m.role === 'admin';
  // FHS-510: self-serve: only the caller's OWN card gets the change-email control.
  const isOwnCard = callerMemberId !== null && m.id === callerMemberId;

  return (
    <MemberCard
      role={m.role}
      name={m.displayName}
      avatarEmoji={m.avatarEmoji}
      statusLine="Signed in"
      badge={<RoleBadge role={m.role} testId={`${testId}-role`} />}
      testId={testId}
      footer={
        callerIsAdmin || isOwnCard ? (
          <>
            {/* FHR-31: on phones the main buttons share one row, delete sits below. */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {/* FHR-30: the edit box has its own Save and Cancel, so hide this. */}
              {callerIsAdmin && editingFor !== m.id && (
                <button
                  type="button"
                  data-testid={`${testId}-edit-name`}
                  onClick={() => setEditingFor(m.id)}
                  className={MEMBER_ACTION_BTN}
                >
                  <Edit2 size={14} aria-hidden="true" /> Edit name
                </button>
              )}
              {/* FHS-510: self-serve: only your OWN card shows "Change email". */}
              {isOwnCard && (
                <button
                  type="button"
                  data-testid={`${testId}-change-email`}
                  disabled={!m.email || Boolean(m.pendingEmail)}
                  title={
                    m.pendingEmail
                      ? 'A change is already pending: see below'
                      : !m.email
                        ? 'You have no sign-in email yet'
                        : undefined
                  }
                  onClick={() => setEmailChangeFor(emailChangeFor === m.id ? null : m.id)}
                  className={`flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-black px-3 text-sm font-bold transition-colors sm:flex-none sm:px-4 ${
                    !m.email || m.pendingEmail
                      ? 'bg-white text-gray-300'
                      : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  <Mail size={14} aria-hidden="true" /> Change email
                </button>
              )}
            </div>
            {callerIsAdmin && (
              <RemoveButton
                testId={testId}
                disabled={lastAdminLock}
                name={m.displayName}
                onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
              />
            )}
          </>
        ) : null
      }
    >
      {callerIsAdmin && isParentRow && (
        <div
          className="mt-4 flex items-center gap-3 rounded-xl border-2 border-black bg-gray-50 p-3"
          data-testid={`${testId}-admin-panel`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm text-black">Admin</p>
            <p className="text-xs font-bold text-gray-500">
              {lastAdminLock
                ? 'The last admin cannot be removed.'
                : isAdminRole
                  ? 'Can change family settings.'
                  : 'Give full family access.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAdminRole}
            data-testid={`${testId}-admin-toggle`}
            disabled={lastAdminLock}
            onClick={() =>
              void mutate(`/api/members/${m.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ role: isAdminRole ? 'adult' : 'admin' }),
              })
            }
            className={`relative inline-flex h-[34px] w-[60px] shrink-0 items-center rounded-full border-2 border-black transition-colors ${
              isAdminRole ? 'bg-emerald-400' : 'bg-gray-200'
            } ${lastAdminLock ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-[26px] w-[26px] rounded-full border-2 border-black bg-white shadow-neo-xs transition-transform ${
                isAdminRole ? 'translate-x-[26px]' : 'translate-x-0.5'
              }`}
            />
            <span className="sr-only">{isAdminRole ? 'Remove admin' : 'Make admin'}</span>
          </button>
        </div>
      )}
      {editingFor === m.id && (
        <EditNameForm
          current={m.displayName}
          testId={testId}
          onCancel={() => setEditingFor(null)}
          onSave={async (name) => {
            const ok = await mutate(`/api/members/${m.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ displayName: name }),
            });
            if (ok) setEditingFor(null);
          }}
        />
      )}
      {/* FHS-510: self-serve: the pending-change card + the change-email form
          only ever render on the caller's OWN card. The API also nulls
          email/pendingEmail on every other row, so this can't leak. */}
      {isOwnCard &&
        (m.pendingEmail ? (
          <PendingEmailChangeCard member={m} testId={testId} mutate={mutate} />
        ) : (
          emailChangeFor === m.id && (
            <EmailChangeForm
              displayName={m.displayName}
              testId={testId}
              onCancel={() => setEmailChangeFor(null)}
              onSave={async (email) => {
                const ok = await mutate(`/api/members/${m.id}/email-change`, {
                  method: 'POST',
                  body: JSON.stringify({ email }),
                });
                if (ok) setEmailChangeFor(null);
              }}
            />
          )
        ))}
    </MemberCard>
  );
}

// FHS-510: step-1 inline form: an admin types the new address and it
// emails a one-time confirm link. Stays open on failure (the page-level
// actionError banner surfaces the reason), same pattern as EditNameForm.
function EmailChangeForm({
  displayName,
  testId,
  onCancel,
  onSave,
}: {
  displayName: string;
  testId: string;
  onCancel: () => void;
  onSave: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubmitting(true);
        void onSave(email.trim()).finally(() => setSubmitting(false));
      }}
      className="mb-4 space-y-3 rounded-md border-2 border-dashed border-black bg-white p-3"
      data-testid={`${testId}-email-change-form`}
    >
      <p className="font-heading text-sm text-black">New email for {displayName}</p>
      <p className="text-xs font-bold text-gray-500">
        We send a confirm link to the new address. The old one keeps working until they click it.
      </p>
      <div>
        <Label htmlFor={`email-change-${testId}`} required>
          New email
        </Label>
        <Input
          id={`email-change-${testId}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="new@example.com"
          testId={`${testId}-email-change-input`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
          testId={`${testId}-email-change-send`}
        >
          {submitting ? 'Sending…' : 'Send confirm link'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// FHS-510: the yellow "a change is in flight" card: shows while the old
// email still works and nobody's clicked the emailed link yet.
function PendingEmailChangeCard({
  member,
  testId,
  mutate,
}: {
  member: MemberItem;
  testId: string;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      className="mt-4 rounded-xl border-2 border-black bg-yellow-100 p-3"
      data-testid={`${testId}-pending-email`}
    >
      <p className="font-heading text-sm text-black">Confirm the new email</p>
      <p className="break-words text-xs font-bold text-gray-700">
        We sent a link to {member.pendingEmail}. Until it is clicked, {member.displayName} still
        signs in with {member.email}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={submitting}
          testId={`${testId}-pending-email-resend`}
          onClick={() => {
            setSubmitting(true);
            void mutate(`/api/members/${member.id}/email-change`, {
              method: 'POST',
              body: JSON.stringify({ email: member.pendingEmail }),
            }).finally(() => setSubmitting(false));
          }}
        >
          Resend
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={submitting}
          testId={`${testId}-pending-email-cancel`}
          onClick={() => {
            setSubmitting(true);
            void mutate(`/api/members/${member.id}/email-change/cancel`, {
              method: 'POST',
            }).finally(() => setSubmitting(false));
          }}
        >
          Cancel change
        </Button>
      </div>
    </div>
  );
}

// ── Kids group card ──────────────────────────────────────────────────────────

interface KidCardProps {
  member: MemberItem;
  idx: number;
  callerRole: string;
  callerIsAdmin: boolean;
  editingFor: string | null;
  setEditingFor: (id: string | null) => void;
  openPinFor: string | null;
  setOpenPinFor: (id: string | null) => void;
  slug: string;
  session: { access_token?: string } | null;
  fetchMembers: () => Promise<void>;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function KidCard({
  member: m,
  idx,
  callerRole,
  callerIsAdmin,
  editingFor,
  setEditingFor,
  openPinFor,
  setOpenPinFor,
  slug,
  session,
  fetchMembers,
  mutate,
}: KidCardProps) {
  const callerCanManagePin = ADMIN_OR_ADULT.has(callerRole) && isPinEligibleRole(m.role);
  const testId = `members-kid-${idx}`;

  return (
    <MemberCard
      role={m.role}
      name={m.displayName}
      avatarEmoji={m.avatarEmoji}
      statusLine={m.hasPin ? 'PIN set' : 'No PIN yet'}
      badge={<RoleBadge role={m.role} age={m.age} testId={`${testId}-role`} />}
      testId={testId}
      footer={
        callerIsAdmin ? (
          <>
            {/* FHR-31: on phones the main buttons share one row, delete sits below. */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {editingFor !== m.id && (
                <button
                  type="button"
                  data-testid={`${testId}-edit-name`}
                  onClick={() => setEditingFor(m.id)}
                  className={MEMBER_ACTION_BTN}
                >
                  <Edit2 size={14} aria-hidden="true" /> Edit name
                </button>
              )}
              {callerCanManagePin && (
                <button
                  type="button"
                  data-testid={`${testId}-pin-toggle`}
                  onClick={() => setOpenPinFor(openPinFor === m.id ? null : m.id)}
                  className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-black bg-white px-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 sm:flex-none sm:px-4"
                >
                  <Key size={14} aria-hidden="true" />
                  {openPinFor === m.id ? 'Cancel' : m.hasPin ? 'Reset PIN' : 'Set PIN'}
                </button>
              )}
            </div>
            <RemoveButton
              testId={testId}
              disabled={false}
              name={m.displayName}
              onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
            />
          </>
        ) : null
      }
    >
      <div
        className="mt-4 rounded-xl border-2 border-black bg-gray-50 p-3"
        data-testid={`${testId}-account-note`}
      >
        <p className="font-heading text-sm text-black">
          {m.role === 'teen' ? 'Teen account' : 'Child account'}
        </p>
        <p className="text-xs font-bold text-gray-500">
          Signs in with a PIN, cannot be given admin access.
        </p>
      </div>
      {editingFor === m.id && (
        <EditNameForm
          current={m.displayName}
          testId={testId}
          onCancel={() => setEditingFor(null)}
          onSave={async (name) => {
            const ok = await mutate(`/api/members/${m.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ displayName: name }),
            });
            if (ok) setEditingFor(null);
          }}
        />
      )}
      {callerCanManagePin && openPinFor === m.id && (
        <KidPinForm
          member={m}
          slug={slug}
          accessToken={session?.access_token}
          testId={testId}
          onDone={() => {
            setOpenPinFor(null);
            void fetchMembers();
          }}
        />
      )}
    </MemberCard>
  );
}

// ── Waiting-to-join row (unclaimed grown-up seats) ──────────────────────────
// FHS-520 (design-fidelity): a compact horizontal row (avatar, name,
// email, role badge, resend/remove) inside the "Waiting to join" white
// card, matching the Magic Patterns mock: no longer a full MemberCard.

interface WaitingCardProps {
  member: MemberItem;
  idx: number;
  callerIsAdmin: boolean;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function WaitingRow({ member: m, idx, callerIsAdmin, mutate }: WaitingCardProps) {
  const testId = `members-waiting-${idx}`;
  // FHS-278 / FHS-519: a seat that hasn't signed up yet can't be made
  // admin (the API rejects the promote: see `target.userId === null` in
  // members.ts). Mirrors GrownUpCard's `isParentRow`: only admin/adult
  // candidates ever show the affordance: a guest is never admin-eligible.
  const isParentRow = m.role === 'admin' || m.role === 'adult';
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border-2 border-black bg-gray-50 p-3 sm:flex-row sm:items-center"
    >
      <AvatarDisc role={m.role} name={m.displayName} emoji={m.avatarEmoji} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-base text-black" data-testid={`${testId}-name`}>
          {m.displayName}
        </p>
        <p className="truncate text-xs font-bold text-gray-500" data-testid={`${testId}-status`}>
          {m.inviteEmail ?? 'No email on file'}
        </p>
        <p
          className="mt-1 flex items-center gap-1.5 text-xs font-bold text-yellow-800"
          data-testid={`${testId}-pending`}
        >
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          Pending: hasn&rsquo;t signed up
        </p>
      </div>
      <RoleBadge role={m.role} testId={`${testId}-role`} />
      {callerIsAdmin && isParentRow && (
        <div
          className="flex shrink-0 items-center gap-2"
          data-testid={`${testId}-admin-panel`}
          title="Available once they sign up"
        >
          <button
            type="button"
            role="switch"
            aria-checked={false}
            aria-label="Make admin: available once they sign up"
            data-testid={`${testId}-admin-toggle`}
            disabled
            className="relative inline-flex h-[34px] w-[60px] shrink-0 cursor-not-allowed items-center rounded-full border-2 border-black bg-gray-200 opacity-40"
          >
            <span
              aria-hidden="true"
              className="inline-block h-[26px] w-[26px] translate-x-0.5 rounded-full border-2 border-black bg-white shadow-neo-xs"
            />
          </button>
          <span className="max-w-[7rem] text-xs font-bold text-gray-500">
            Available once they sign up
          </span>
        </div>
      )}
      {callerIsAdmin && (
        <div className="flex shrink-0 items-center gap-2">
          {m.inviteId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              testId={`${testId}-resend`}
              onClick={() =>
                void mutate(`/api/invitations/${m.inviteId}/resend`, { method: 'POST' })
              }
            >
              Resend
            </Button>
          )}
          <RemoveButton
            testId={testId}
            disabled={false}
            name={m.displayName}
            onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
          />
        </div>
      )}
    </div>
  );
}

// FHS-437: parent-side counterpart to the self-serve kid login: without
// this, a parent had no way to find or share the link/code their kid needs
// to sign in, so a brand-new family's kid had no working path in at all.
// FHS-513: now a collapsible "How your kids sign in" card with the same
// link/code + copy button, plus the 3-step walkthrough from the design.
function KidLoginHelp({ slug, kidsCount }: { slug: string; kidsCount: number }) {
  const [copied, setCopied] = useState(false);
  const kidLoginUrl = `${window.location.origin}/t/${slug}/kid-login`;

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(kidLoginUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission blocked / unavailable: the link and code are
      // still visible on-screen to copy by hand.
    }
  }, [kidLoginUrl]);

  return (
    <CollapsibleSection
      defaultOpen={false}
      emoji="🔑"
      title="How your kids sign in"
      subtitle={`${kidsCount} kid${kidsCount === 1 ? '' : 's'} use your family code and their own PIN.`}
      tileClassName="bg-purple-300"
      testId="members-kid-login-share"
    >
      {/* FHS-530: two clear steps, not a misleading 1/2/3 sequence: step 1 is
          how to REACH the login (a link OR the family code: either opens it),
          step 2 is what the kid does once there. */}
      <ol className="space-y-3">
        <KidLoginStep number="1" title="Open their login page">
          <p className="mt-1 text-sm font-bold text-gray-500">
            Send them this link, or have them type your family code on the kid-login page: either
            one opens it.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code
              className="flex min-h-[48px] flex-1 items-center break-all rounded-xl border-2 border-black bg-gray-50 px-3 text-sm font-bold text-gray-800"
              data-testid="members-kid-login-url"
            >
              {kidLoginUrl}
            </code>
            <button
              type="button"
              onClick={() => void onCopy()}
              data-testid="members-kid-login-copy"
              className="flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-black bg-yellow-300 px-4 text-sm font-bold shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
            >
              {copied ? (
                <>
                  <Check size={16} strokeWidth={3} aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy size={16} strokeWidth={3} aria-hidden="true" /> Copy link
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            Or your family code
          </p>
          <span
            className="mt-1 inline-block rounded-xl border-2 border-black bg-purple-100 px-4 py-2 font-heading text-xl tracking-[0.2em]"
            data-testid="members-kid-login-code"
          >
            {slug}
          </span>
        </KidLoginStep>
        <KidLoginStep number="2" title="They tap their face and enter their PIN">
          <p className="mt-1 text-sm font-bold text-gray-500">Set each PIN on their card below.</p>
        </KidLoginStep>
      </ol>
    </CollapsibleSection>
  );
}

// FHS-521: one numbered step in the "How your kids sign in" card, matching
// the design (a yellow round number badge + title + content).
function KidLoginStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-300 font-heading text-base">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="pt-1 font-heading text-base leading-tight">{title}</p>
        {children}
      </div>
    </li>
  );
}

// FHS-486 / ADR 0019: the role a caller can invite from Manage Members.
// `child` is excluded: kids use PIN login, never the magic-link invite
// (ADR 0009 / FHS-234). FHS-513: `teen` is also dropped from THIS form
// (the design routes teens through "Add a child" instead); the server
// still accepts a teen invite for backward compatibility, this UI just
// no longer offers it.
// FHS-519: this form only ever renders for an admin caller
// (`activeForm === 'invite' && callerIsAdmin` at the call site), so all
// three options are always safe to show; a per-option `adminOnly` filter
// here was dead code (always true). The server independently enforces
// the admin-grant safeguard (only an admin may hand out 'admin' via the
// API): this UI doesn't need to re-filter it.
type InviteRole = 'admin' | 'adult' | 'guest';

const INVITE_ROLE_OPTIONS: Array<{ value: InviteRole; label: string }> = [
  { value: 'admin', label: 'Parent / partner' },
  { value: 'adult', label: 'Adult' },
  { value: 'guest', label: 'Guest' },
];

const INVITE_ROLE_HELP: Record<InviteRole, string> = {
  admin: 'Full access: everyday tasks, past-date edits, the economy, and family settings.',
  adult: 'Day-to-day help: grandma, a cousin, a sitter. No past-date edits or admin tools.',
  guest: 'Can log in and see everything, but can’t change anything.',
};

// FHS-521: one selectable card in the "What can they do?" role picker,
// matching the Magic Patterns design: a radio circle (Check when active),
// the role label, and its one-line note, all in one clickable card.
function RoleOptionCard({
  value,
  label,
  note,
  selected,
  onSelect,
}: {
  value: InviteRole;
  label: string;
  note: string;
  selected: boolean;
  onSelect: (value: InviteRole) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={`members-invite-role-${value}`}
      onClick={() => onSelect(value)}
      className={`flex items-start gap-3 rounded-xl border-2 border-black p-3 text-left transition-colors ${
        selected ? 'bg-pink-400 shadow-neo-xs' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white"
      >
        {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-base">{label}</span>
        <span className="mt-0.5 block text-xs font-bold text-gray-600">{note}</span>
      </span>
    </button>
  );
}

function InviteAdultForm({
  callerIsAdmin,
  onClose,
  onSubmit,
  error,
}: {
  callerIsAdmin: boolean;
  onClose: () => void;
  onSubmit: (email: string, name: string | null, role: InviteRole) => Promise<void>;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // FHS-524: default to "Parent / partner" (admin) so inviting a co-parent is
  // one tap. Non-admins can't pick (or see) admin, so they fall back to "adult".
  const [role, setRole] = useState<InviteRole>(callerIsAdmin ? 'admin' : 'adult');
  const [submitting, setSubmitting] = useState(false);

  return (
    <FormCard
      title="Invite an adult"
      description="For grown-ups only. We email them a sign-in link, no password needed. Kids are added with a PIN instead."
      onClose={onClose}
      closeLabel="Close invite form"
      testId="members-invite-form"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          setSubmitting(true);
          void onSubmit(email.trim(), name.trim() || null, role).finally(() =>
            setSubmitting(false),
          );
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="invite-adult-name">Name</Label>
            <Input
              id="invite-adult-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Yusuf"
              testId="members-invite-name"
            />
          </div>
          <div>
            <Label htmlFor="invite-adult-email" required>
              Email
            </Label>
            <Input
              id="invite-adult-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yusuf@example.com"
              testId="members-invite-email"
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            What can they do?
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2" role="radiogroup">
            {INVITE_ROLE_OPTIONS.map((r) => (
              <RoleOptionCard
                key={r.value}
                value={r.value}
                label={r.label}
                note={INVITE_ROLE_HELP[r.value]}
                selected={role === r.value}
                onSelect={setRole}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center">
          <Button
            type="submit"
            variant="purple"
            size="md"
            disabled={submitting}
            testId="members-invite-send"
          >
            <Send size={16} aria-hidden="true" /> {submitting ? 'Sending…' : 'Send sign-in link'}
          </Button>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          data-testid="members-invite-error"
          className="mt-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </FormCard>
  );
}

// FHS-513: "Add a child" is now Child/Teen only (no-login, PIN-based
// seats), matching the finalised design's two-CTA header. The previous
// "Add member → Adult (no login)" path is removed from this form; the
// POST /api/members endpoint still accepts role: 'adult' unchanged, an
// admin/adult grown-up seat is created going forward via Invite instead.
type AddChildRole = 'child' | 'teen';

const ADD_CHILD_ROLE_OPTIONS: Array<{
  value: AddChildRole;
  emoji: string;
  label: string;
  note: string;
}> = [
  { value: 'child', emoji: '🧒🏽', label: 'Child', note: 'Younger kid. Habits, stars and rewards.' },
  { value: 'teen', emoji: '🧑🏽', label: 'Teen', note: 'Older kid. Same world, more grown-up.' },
];

// FHS-521: one selectable card in the "How old are they?" picker,
// matching the Magic Patterns design: an emoji, the type label, and its
// one-line note, all in one clickable card (no radio circle: the
// active fill is the only selected-state indicator here, per the mock).
function ChildTypeCard({
  value,
  emoji,
  label,
  note,
  selected,
  onSelect,
}: {
  value: AddChildRole;
  emoji: string;
  label: string;
  note: string;
  selected: boolean;
  onSelect: (value: AddChildRole) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={`members-add-child-role-${value}`}
      onClick={() => onSelect(value)}
      className={`rounded-xl border-2 border-black p-3 text-left transition-colors ${
        selected ? 'bg-yellow-300 shadow-neo-xs' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="mt-1 block font-heading text-base">{label}</span>
      <span className="mt-0.5 block text-xs font-bold text-gray-600">{note}</span>
    </button>
  );
}

function AddChildForm({
  onClose,
  onSubmit,
  error,
}: {
  onClose: () => void;
  onSubmit: (displayName: string, role: AddChildRole) => Promise<void>;
  error: string | null;
}) {
  const [role, setRole] = useState<AddChildRole>('child');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <FormCard
      title="Add a child"
      description="No email needed. They sign in with a 4-digit PIN you set on their card."
      onClose={onClose}
      closeLabel="Close add-a-child form"
      testId="members-add-child-form"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setSubmitting(true);
          void onSubmit(name.trim(), role).finally(() => setSubmitting(false));
        }}
      >
        <div>
          <Label htmlFor="add-child-name" required>
            Name
          </Label>
          <Input
            id="add-child-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina"
            testId="members-add-child-name"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            How old are they?
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
            {ADD_CHILD_ROLE_OPTIONS.map((r) => (
              <ChildTypeCard
                key={r.value}
                value={r.value}
                emoji={r.emoji}
                label={r.label}
                note={r.note}
                selected={role === r.value}
                onSelect={setRole}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center">
          <Button
            type="submit"
            variant="purple"
            size="md"
            disabled={submitting}
            testId="members-add-child-save"
          >
            <UserPlus size={16} aria-hidden="true" /> {submitting ? 'Adding…' : 'Add to the family'}
          </Button>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          data-testid="members-add-child-error"
          className="mt-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </FormCard>
  );
}

function EditNameForm({
  current,
  testId,
  onCancel,
  onSave,
}: {
  current: string;
  testId: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(current);
  const [submitting, setSubmitting] = useState(false);
  // FHR-30: the "Edit name" button hides when this opens, so move focus here
  // rather than leave keyboard and screen-reader users at the top of the page.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <form
      className="mb-4 flex items-end gap-2"
      data-testid={`${testId}-edit-form`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        void onSave(name.trim()).finally(() => setSubmitting(false));
      }}
    >
      <div className="flex-1">
        <Label htmlFor={`edit-name-${testId}`}>New name</Label>
        <Input
          id={`edit-name-${testId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          ref={inputRef}
          testId={`${testId}-edit-input`}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={submitting}
        testId={`${testId}-edit-save`}
      >
        Save
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

// Two-tap remove: first tap arms ("Really remove?"), second confirms.
// Avoids a window.confirm (untestable + jarring) without a full dialog.
function RemoveButton({
  testId,
  disabled,
  name,
  onConfirm,
}: {
  testId: string;
  disabled: boolean;
  name: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      // FHR-29: the question wraps inside the card instead of running off it.
      <span className="flex w-full min-w-0 items-center gap-2">
        <button
          type="button"
          data-testid={`${testId}-remove-confirm`}
          onClick={onConfirm}
          title="Their personal tasks and meals are removed too"
          className="min-h-[44px] min-w-0 flex-1 whitespace-normal break-words rounded border-2 border-black bg-red-100 px-2 py-1 text-left text-xs font-bold text-red-700"
        >
          Remove {name}? (their tasks &amp; meals go too)
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="inline-flex min-h-[44px] items-center px-2 text-xs font-bold text-gray-500 hover:text-black"
        >
          Keep
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={`${testId}-remove`}
      disabled={disabled}
      onClick={() => setArmed(true)}
      title={`Remove ${name}`}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white transition-colors ${
        disabled ? 'cursor-not-allowed text-gray-300' : 'text-red-600 hover:bg-red-50'
      }`}
    >
      <Trash2 size={18} aria-hidden="true" />
    </button>
  );
}

// FHS-252: inline form for setting / resetting a kid PIN. Unchanged
// behaviour from the pre-FHS-513 page: just re-keyed off the new
// per-card `testId` prefix instead of a row index.

interface KidPinFormProps {
  member: { id: string; displayName: string; hasPin: boolean };
  slug: string;
  accessToken: string | undefined;
  testId: string;
  onDone: () => void;
}

function KidPinForm({ member, slug, accessToken, testId, onDone }: KidPinFormProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits.');
        return;
      }
      if (pin !== confirm) {
        setError("PINs don't match. Type the same digits twice.");
        return;
      }
      if (!accessToken) {
        setError('Not signed in. Refresh and try again.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/members/${member.id}/pin`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-tenant-slug': slug,
          },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          setError(body.detail ?? body.error ?? `Server returned ${res.status}.`);
          setSubmitting(false);
          return;
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error. Try again.');
        setSubmitting(false);
      }
    },
    [pin, confirm, member.id, slug, accessToken, onDone],
  );

  const onRemove = useCallback(async () => {
    setError(null);
    if (!accessToken) {
      setError('Not signed in. Refresh and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/members/${member.id}/pin`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': slug },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Server returned ${res.status}.`);
        setSubmitting(false);
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Try again.');
      setSubmitting(false);
    }
  }, [member.id, slug, accessToken, onDone]);

  return (
    <form
      onSubmit={onSet}
      className="mb-4 space-y-3 rounded-md border-2 border-dashed border-black bg-white p-3"
      data-testid={`${testId}-pin-form`}
    >
      <p className="font-body text-sm text-gray-700">
        Set a 4-digit PIN for <span className="font-bold text-black">{member.displayName}</span>.
        They&rsquo;ll type this on the family iPad to log in.
      </p>
      <div>
        <Label htmlFor={`pin-${member.id}`} required>
          PIN
        </Label>
        <Input
          id={`pin-${member.id}`}
          name="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          testId={`${testId}-pin-input`}
        />
      </div>
      <div>
        <Label htmlFor={`pin-confirm-${member.id}`} required>
          Confirm PIN
        </Label>
        <Input
          id={`pin-confirm-${member.id}`}
          name="pin-confirm"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          testId={`${testId}-pin-confirm`}
        />
      </div>
      {error && (
        <p
          className="text-sm font-bold text-red-600"
          role="alert"
          data-testid={`${testId}-pin-error`}
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
          testId={`${testId}-pin-save`}
        >
          {submitting ? 'Saving…' : 'Save PIN'}
        </Button>
        {member.hasPin && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={submitting}
            onClick={() => void onRemove()}
            testId={`${testId}-pin-remove`}
          >
            Remove kid login
          </Button>
        )}
      </div>
    </form>
  );
}
