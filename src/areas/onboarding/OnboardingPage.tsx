import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronDown } from 'lucide-react';
import {
  AvatarEmojiPicker,
  Button,
  Card,
  CurrencyPicker,
  Input,
  Label,
  Select,
  StepperHeader,
  TimezonePicker,
  detectBrowserCurrency,
  detectBrowserTimezone,
} from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { isKidRole } from '@familyhub/shared';

// FHS-36 / FHS-37: OnboardingWizard at /t/:slug/onboarding.
//
// Multi-step wizard the founding admin walks through once per family
// right after signup. Local state until the very end; one POST to
// /api/onboarding/complete on the final step. Returning users with
// `tenant.onboarding_completed === true` are bounced to /dashboard
// before the wizard ever paints.
//
// FHS-432: timezone + currency are now auto-detected from the browser
// and shown in a confirmation step (step 3). The user only touches the
// pickers if the detected value is wrong or detection fails.
//
// Steps:
//   1. Welcome
//   2. Add 1–8 members (name + role + emoji)
//   3. Location: auto-detected timezone + currency with optional Change affordance
//   4. Done: POSTs everything, redirects to /dashboard

const STEPS = ['Welcome', 'Members', 'Location', 'Done'] as const;

const ROLE_OPTIONS = [
  { value: 'adult', label: 'Adult' },
  { value: 'teen', label: 'Teen' },
  { value: 'child', label: 'Child' },
  { value: 'guest', label: 'Guest' },
] as const;

interface WizardMember {
  // Local-only id so React can key the rows; never sent to the server.
  uiId: string;
  displayName: string;
  role: 'adult' | 'teen' | 'child' | 'guest';
  avatarEmoji?: string;
  // FHS-275: optional invite email (adults only): they get a sign-in
  // link and become this member on first login.
  email?: string;
  // FHS-487: optional age in years, child rows only. Captured for
  // later use: nothing reads it yet. Adults/teens/guests never set this.
  age?: number;
}

function makeUiId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type Status =
  | { kind: 'loading' }
  | { kind: 'gated' } // user has completed onboarding: redirecting
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

interface MeResponse {
  tenants: Array<{ slug: string; onboardingCompleted: boolean }>;
}

interface TodayNames {
  callerMemberId?: string;
  members?: Array<{ id: string; displayName?: string | null }>;
}

// FHR-24: names longer than this broke the dashboard header.
const NAME_MAX = 40;

// Detection is considered "failed" for timezone if the value is empty,
// and for currency if it isn't a valid 3-letter ISO 4217 code.
function isValidTimezone(tz: string): boolean {
  return tz.trim().length > 0;
}

function isValidCurrency(ccy: string): boolean {
  return /^[A-Z]{3}$/.test(ccy);
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [step, setStep] = useState(1);
  // FHS-274: the founder is shown as a pinned "You: Admin" row and
  // submitted as `yourName` (renames their admin row server-side).
  // The list below holds only the OTHER family members.
  const [yourName, setYourName] = useState('');
  const [members, setMembers] = useState<WizardMember[]>([]);

  // FHS-432: detect on mount; detection result drives fallback logic.
  const detectedTimezone = useMemo(() => detectBrowserTimezone(), []);
  const detectedCurrency = useMemo(() => detectBrowserCurrency(), []);

  const [timezone, setTimezone] = useState<string>(detectedTimezone);
  const [currency, setCurrency] = useState<string>(detectedCurrency);

  // Whether the user has expanded the "Change" affordance for each field.
  // Starts true when detection failed so the picker is shown immediately.
  const [showTimezonePicker, setShowTimezonePicker] = useState(!isValidTimezone(detectedTimezone));
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(!isValidCurrency(detectedCurrency));

  // FHR-25: fill "Your name" with the name the founder typed on the create
  // screen (their saved member row). Only when that is missing, suggest the
  // Google name. Either way it is a suggestion they can change before saving.
  const { user } = useAuth();
  const [savedName, setSavedName] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/dashboard/today`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((today: TodayNames | null) => {
        if (cancelled || !today) return;
        const me = today.members?.find((m) => m.id === today.callerMemberId);
        const name = me?.displayName?.trim();
        if (name) setSavedName(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, slug]);
  useEffect(() => {
    if (nameTouched) return;
    if (savedName) {
      setYourName(savedName);
      return;
    }
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const guess = (meta.full_name ?? meta.name ?? '').trim();
    if (guess.length >= 2) setYourName(guess.slice(0, NAME_MAX));
  }, [savedName, user, nameTouched]);

  // FHR-26: once Next is pressed with a gap, say what is missing.
  const [showErrors, setShowErrors] = useState(false);

  // Gate check on mount: hit /api/me, find this slug in tenants[],
  // bounce to /dashboard if onboarding_completed=true. Renders the
  // wizard only for first-timers.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          // 401/403 → bail out, AuthProvider will route to /login.
          if (!cancelled) setStatus({ kind: 'ready' });
          return;
        }
        const body = (await res.json()) as MeResponse;
        const t = body.tenants.find((x) => x.slug === slug);
        if (!cancelled) {
          if (t && t.onboardingCompleted) {
            setStatus({ kind: 'gated' });
            navigate(`/t/${slug}/dashboard`, { replace: true });
          } else {
            setStatus({ kind: 'ready' });
          }
        }
      } catch {
        // Network blip: let the user see the wizard; the final
        // submit will surface any real backend issue.
        if (!cancelled) setStatus({ kind: 'ready' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, slug, navigate]);

  const stepLabel = STEPS[step - 1] ?? '';
  const isFinalStep = step === STEPS.length;
  const canAdvance = useMemo(() => {
    if (step === 2) {
      return (
        yourName.trim().length >= 1 &&
        members.length <= 7 &&
        members.every((m) => m.displayName.trim().length >= 1)
      );
    }
    // Location step: both values must be valid (user may have edited them).
    if (step === 3) return isValidTimezone(timezone) && isValidCurrency(currency);
    return true;
  }, [step, yourName, members, timezone, currency]);

  function addMember() {
    if (members.length >= 7) return;
    setMembers((prev) => [...prev, { uiId: makeUiId(), displayName: '', role: 'adult' }]);
  }

  function removeMember(uiId: string) {
    // Others can drop to zero: the founder ("You") is always present.
    setMembers((prev) => prev.filter((m) => m.uiId !== uiId));
  }

  function patchMember(uiId: string, patch: Partial<WizardMember>) {
    setMembers((prev) => prev.map((m) => (m.uiId === uiId ? { ...m, ...patch } : m)));
  }

  // FHS-487: separate setter (not patchMember) because clearing the age
  // field must OMIT the key rather than set it to undefined
  // (exactOptionalPropertyTypes forbids `age: undefined` on an `age?:
  // number` field). Same rebuild-without-the-key approach as the emoji
  // clear handler above.
  function patchMemberAge(uiId: string, raw: string) {
    setMembers((prev) =>
      prev.map((row) => {
        if (row.uiId !== uiId) return row;
        if (raw !== '') {
          const n = Number(raw);
          // Only whole numbers 1–25 (matches the server schema + the Manage
          // Members "Add a child" form). Reject anything else so we never
          // submit a value the server would 400 the whole wizard on.
          if (!Number.isInteger(n) || n < 1 || n > 25) return row;
          return { ...row, age: n };
        }
        const cleared: WizardMember = {
          uiId: row.uiId,
          displayName: row.displayName,
          role: row.role,
        };
        if (row.avatarEmoji) cleared.avatarEmoji = row.avatarEmoji;
        if (row.email) cleared.email = row.email;
        return cleared;
      }),
    );
  }

  async function submit() {
    if (!session) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-tenant-slug': slug,
        },
        body: JSON.stringify({
          timezone,
          currency,
          yourName: yourName.trim(),
          members: members.map((m) => ({
            displayName: m.displayName.trim(),
            role: m.role,
            ...(m.avatarEmoji ? { avatarEmoji: m.avatarEmoji } : {}),
            ...(m.role === 'adult' && m.email?.trim() ? { email: m.email.trim() } : {}),
            ...(isKidRole(m.role) && typeof m.age === 'number' ? { age: m.age } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
        setStatus({
          kind: 'error',
          message: body.detail ?? body.error ?? `Server returned ${res.status}`,
        });
        return;
      }
      navigate(`/t/${slug}/dashboard`, { replace: true });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error. Try again.',
      });
    }
  }

  if (status.kind === 'loading' || status.kind === 'gated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kingdom-bg p-6 font-body text-white">
        <p data-testid="onboarding-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg p-6 font-body text-white">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-2 font-heading text-3xl text-yellow-300">Set up your family</h1>
        <p className="mb-6 text-purple-100">
          A few quick steps and we&rsquo;ll have your hub ready. Step {step} of {STEPS.length}:{' '}
          <span className="font-bold text-white">{stepLabel}</span>.
        </p>

        <StepperHeader
          steps={STEPS.length}
          current={step}
          labels={[...STEPS]}
          testId="onboarding-stepper"
        />

        <Card className="mt-8 bg-white p-6 text-gray-900 md:p-8" data-testid="onboarding-card">
          {step === 1 && (
            <div data-testid="onboarding-step-welcome">
              <h2 className="mb-3 font-heading text-2xl">Welcome aboard.</h2>
              <p className="mb-4 font-bold text-gray-700">
                A few quick steps and your family is good to go. Add the people in your family and
                you&rsquo;re live. We&rsquo;ll handle the timezone and currency automatically.
              </p>
              <p className="text-sm text-gray-600">
                You can always change any of this later from settings.
              </p>
            </div>
          )}

          {step === 2 && (
            <div data-testid="onboarding-step-members">
              <h2 className="mb-3 font-heading text-2xl">Who&rsquo;s in the family?</h2>
              <p className="mb-4 font-bold text-gray-600">
                That&rsquo;s you below, then add the rest of the family. You can always invite more
                later.
              </p>
              <div
                className="mb-3 rounded-md border-2 border-black bg-pink-50 p-3 shadow-neo-sm"
                data-testid="onboarding-member-you"
              >
                <div className="grid gap-3 md:grid-cols-[1fr,140px]">
                  <div>
                    <Label htmlFor="onboarding-your-name">Your name</Label>
                    <Input
                      id="onboarding-your-name"
                      value={yourName}
                      onChange={(e) => {
                        setNameTouched(true);
                        setYourName(e.target.value);
                      }}
                      maxLength={NAME_MAX}
                      placeholder="e.g. Sarah"
                      error={showErrors && yourName.trim().length === 0}
                      aria-invalid={showErrors && yourName.trim().length === 0 ? true : undefined}
                      aria-describedby={
                        showErrors && yourName.trim().length === 0
                          ? 'onboarding-your-name-error'
                          : undefined
                      }
                      testId="onboarding-your-name"
                    />
                    {showErrors && yourName.trim().length === 0 && (
                      <p
                        id="onboarding-your-name-error"
                        className="mt-1 text-sm font-bold text-red-600"
                        data-testid="onboarding-your-name-error"
                      >
                        Enter your name.
                      </p>
                    )}
                  </div>
                  <div className="flex items-end pb-1">
                    <span className="rounded-full border-2 border-black bg-pink-200 px-3 py-1 text-xs font-bold">
                      You · Admin
                    </span>
                  </div>
                </div>
              </div>
              <ul className="space-y-3" data-testid="onboarding-members-list">
                {members.map((m, idx) => (
                  <li
                    key={m.uiId}
                    className="rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
                    data-testid={`onboarding-member-${idx}`}
                  >
                    {/* Name + Role + Remove on one row */}
                    <div className="grid gap-3 md:grid-cols-[1fr,140px,44px]">
                      <div>
                        <Label htmlFor={`member-name-${m.uiId}`}>Name</Label>
                        <Input
                          id={`member-name-${m.uiId}`}
                          value={m.displayName}
                          onChange={(e) => patchMember(m.uiId, { displayName: e.target.value })}
                          maxLength={NAME_MAX}
                          placeholder="e.g. Iman"
                          error={showErrors && m.displayName.trim().length === 0}
                          aria-invalid={
                            showErrors && m.displayName.trim().length === 0 ? true : undefined
                          }
                          aria-describedby={
                            showErrors && m.displayName.trim().length === 0
                              ? `member-name-error-${m.uiId}`
                              : undefined
                          }
                          testId={`onboarding-member-name-${idx}`}
                        />
                        {showErrors && m.displayName.trim().length === 0 && (
                          <p
                            id={`member-name-error-${m.uiId}`}
                            className="mt-1 text-sm font-bold text-red-600"
                            data-testid={`onboarding-member-name-error-${idx}`}
                          >
                            Enter a name, or remove this person.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`member-role-${m.uiId}`}>Role</Label>
                        <Select
                          id={`member-role-${m.uiId}`}
                          value={m.role}
                          onChange={(e) =>
                            patchMember(m.uiId, { role: e.target.value as WizardMember['role'] })
                          }
                          data-testid={`onboarding-member-role-${idx}`}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => removeMember(m.uiId)}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border-2 border-black bg-red-200 p-2 text-black shadow-neo-sm transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Remove member ${idx + 1}`}
                          data-testid={`onboarding-member-remove-${idx}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {/* Emoji picker: full width below the inline row */}
                    <div className="mt-2">
                      <Label>Emoji (optional)</Label>
                      <AvatarEmojiPicker
                        value={m.avatarEmoji ?? ''}
                        onSelect={(next) => {
                          // exactOptionalPropertyTypes: omit the key
                          // when clearing rather than setting undefined.
                          setMembers((prev) =>
                            prev.map((row) => {
                              if (row.uiId !== m.uiId) return row;
                              if (next) return { ...row, avatarEmoji: next };
                              // Clearing the emoji must keep the row's other
                              // optional fields (email, age): rebuild without
                              // just avatarEmoji.
                              const cleared: WizardMember = {
                                uiId: row.uiId,
                                displayName: row.displayName,
                                role: row.role,
                              };
                              if (row.email) cleared.email = row.email;
                              if (typeof row.age === 'number') cleared.age = row.age;
                              return cleared;
                            }),
                          );
                        }}
                        testId={`onboarding-member-emoji-${idx}`}
                      />
                    </div>
                    {m.role === 'adult' && (
                      <div className="mt-3">
                        <Label htmlFor={`member-email-${m.uiId}`}>
                          Email (optional, we&rsquo;ll invite them to sign in)
                        </Label>
                        <Input
                          id={`member-email-${m.uiId}`}
                          type="email"
                          value={m.email ?? ''}
                          onChange={(e) => patchMember(m.uiId, { email: e.target.value })}
                          placeholder="e.g. yusuf@example.com"
                          testId={`onboarding-member-email-${idx}`}
                        />
                      </div>
                    )}
                    {/* FHS-487: optional age for kids (child or teen). Shows on
                        their Manage Members card (e.g. "Child (6)"). */}
                    {isKidRole(m.role) && (
                      <div className="mt-3">
                        <Label htmlFor={`member-age-${m.uiId}`}>Age (optional)</Label>
                        <Input
                          id={`member-age-${m.uiId}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={25}
                          value={m.age ?? ''}
                          onChange={(e) => patchMemberAge(m.uiId, e.target.value)}
                          placeholder="e.g. 6"
                          testId={`onboarding-member-age-${idx}`}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={addMember}
                disabled={members.length >= 7}
                testId="onboarding-add-member"
                className="mt-4"
              >
                + Add another
              </Button>
            </div>
          )}

          {/* FHS-432: Location step: auto-detected values confirmed,
              pickers hidden unless detection failed or the user taps "Change". */}
          {step === 3 && (
            <div data-testid="onboarding-step-location">
              <h2 className="mb-3 font-heading text-2xl">Your location</h2>
              <p className="mb-5 text-gray-600">
                We&rsquo;ve set these from your device. You can change them here or later in
                settings.
              </p>

              {/* Timezone row */}
              <div className="mb-4" data-testid="onboarding-location-timezone-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {!showTimezonePicker && (
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Timezone
                      </p>
                    )}
                    {!showTimezonePicker && (
                      <p
                        className="mt-0.5 text-base font-semibold text-gray-900"
                        data-testid="onboarding-detected-timezone"
                      >
                        {timezone || 'Not detected'}
                      </p>
                    )}
                  </div>
                  {!showTimezonePicker && (
                    <button
                      type="button"
                      onClick={() => setShowTimezonePicker(true)}
                      className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 shadow-neo-sm transition-all motion-safe:hover:-translate-y-0.5"
                      data-testid="onboarding-timezone-change"
                      aria-label="Change timezone"
                    >
                      Change <ChevronDown size={14} />
                    </button>
                  )}
                </div>
                {showTimezonePicker && (
                  <div className="mt-2">
                    <Label htmlFor="onboarding-timezone-trigger">Timezone</Label>
                    <TimezonePicker
                      id="onboarding-timezone-trigger"
                      value={timezone}
                      onChange={setTimezone}
                      testId="onboarding-timezone"
                    />
                  </div>
                )}
              </div>

              {/* Currency row */}
              <div className="mb-2" data-testid="onboarding-location-currency-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {/* FHS-570: the picker brings its own <Label>, so the
                        row heading would print "Currency" twice once open. */}
                    {!showCurrencyPicker && (
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Currency
                      </p>
                    )}
                    {!showCurrencyPicker && (
                      <p
                        className="mt-0.5 text-base font-semibold text-gray-900"
                        data-testid="onboarding-detected-currency"
                      >
                        {currency || 'Not detected'}
                      </p>
                    )}
                  </div>
                  {!showCurrencyPicker && (
                    <button
                      type="button"
                      onClick={() => setShowCurrencyPicker(true)}
                      className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 shadow-neo-sm transition-all motion-safe:hover:-translate-y-0.5"
                      data-testid="onboarding-currency-change"
                      aria-label="Change currency"
                    >
                      Change <ChevronDown size={14} />
                    </button>
                  )}
                </div>
                {showCurrencyPicker && (
                  <div className="mt-2">
                    <Label htmlFor="onboarding-currency-trigger">Currency</Label>
                    <CurrencyPicker
                      id="onboarding-currency-trigger"
                      value={currency}
                      onChange={setCurrency}
                      testId="onboarding-currency"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div data-testid="onboarding-step-done">
              <h2 className="mb-3 font-heading text-2xl">All set?</h2>
              <p className="mb-4 font-bold text-gray-600">
                You&rsquo;re joining as <span className="text-black">{yourName.trim()}</span>{' '}
                (admin) with <span className="text-black">{members.length}</span> other family
                member{members.length === 1 ? '' : 's'}, timezone{' '}
                <span className="text-black">{timezone}</span>, and{' '}
                <span className="text-black">{currency}</span> as your currency.
              </p>
              <p className="mb-4 text-sm text-gray-600">
                Click <strong>Finish setup</strong> to land on your dashboard. You can edit any of
                this later from settings.
              </p>
            </div>
          )}

          {status.kind === 'error' && (
            <p
              className="mt-4 text-sm font-bold text-red-600"
              role="alert"
              data-testid="onboarding-error"
            >
              {status.message}
            </p>
          )}

          {showErrors && !canAdvance && (
            <p
              role="alert"
              className="mt-4 text-sm font-bold text-red-600"
              data-testid="onboarding-step-error"
            >
              {step === 2
                ? 'Fill in every name to continue.'
                : 'Check the highlighted details to continue.'}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            {/* FHR-28: step 1 has nowhere to go back to, so no Back button. */}
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowErrors(false);
                  setStep((s) => Math.max(1, s - 1));
                }}
                disabled={status.kind === 'submitting'}
                testId="onboarding-back"
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            {isFinalStep ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={submit}
                disabled={status.kind === 'submitting'}
                testId="onboarding-finish"
              >
                {status.kind === 'submitting' ? 'Setting up…' : 'Finish setup'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  if (!canAdvance) {
                    setShowErrors(true);
                    // Move to the first empty box so its message is read out.
                    if (step === 2) {
                      const firstBlank =
                        yourName.trim().length === 0
                          ? 'onboarding-your-name'
                          : members.find((m) => m.displayName.trim().length === 0)
                            ? `member-name-${members.find((m) => m.displayName.trim().length === 0)!.uiId}`
                            : null;
                      if (firstBlank) {
                        requestAnimationFrame(() => document.getElementById(firstBlank)?.focus());
                      }
                    }
                    return;
                  }
                  setShowErrors(false);
                  setStep((s) => Math.min(STEPS.length, s + 1));
                }}
                testId="onboarding-next"
              >
                Next →
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
