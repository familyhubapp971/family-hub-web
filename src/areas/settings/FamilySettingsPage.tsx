/**
 * FamilySettingsPage: "Family settings" (FHS-624).
 *
 * /t/:slug/family-settings. The things a parent sets once, and the two they
 * hope never to touch: the family's name, the currency the whole app shows
 * money in, downloading the family's data, and deleting the family hub.
 *
 * Everyday controls (what a sticker is worth, what happens on a skipped day)
 * live on Earning rules (/t/:slug/reward-settings): this page only links
 * there, per FHS-620's split of the old Admin Panel.
 *
 * Ports the Magic Patterns design (editor kudjspxd3xxroueg5jw11o, artifact
 * 265da613-5c0f-45f1-bfc9-9c840d102995, pages/FamilySettings.tsx) with every
 * control wired to a real endpoint:
 *   - family name  → PUT /api/admin/settings/familyName (FHS-626)
 *   - currency     → PUT /api/admin/settings/currency
 *   - export       → GET /api/admin/export (real file, not a fake message)
 *   - delete       → POST /api/admin/delete-account (confirm = family name)
 *
 * DEVIATION from the design: the design also offered a "short line
 * underneath" the family name. FHS-626 deliberately shipped no endpoint for
 * it (see that ticket's "What to cover": "a decision on whether it is worth
 * having at all"), so it is dropped here rather than shown as an editable
 * field that quietly does nothing. Record kept in
 * documents/features/family-settings.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Compass, Download, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, CurrencyPicker, Label } from '@familyhub/ui';
import { formatMoney, isFamilyAdminRole } from '@familyhub/shared';
import { signOutAll, useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { AppHeader } from '../../app/layout/AppHeader';
import { DEFAULT_TAB } from '../../app/layout/dashboard-tabs';

type Status = 'loading' | 'ready' | 'error';

const NAME_MAX_LENGTH = 80;
// An example figure so a parent can see how their chosen currency actually
// renders (symbol placement, decimal separator) before they save it.
const CURRENCY_PREVIEW_AMOUNT = 12.5;

export function FamilySettingsPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();

  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // null = still loading; string = loaded (may be 'admin', 'adult', 'child', …)
  const [callerRole, setCallerRole] = useState<string | null>(null);

  const [savedFamilyName, setSavedFamilyName] = useState('');
  const [savedCurrency, setSavedCurrency] = useState('USD');
  const [familyName, setFamilyName] = useState('');
  const [currency, setCurrency] = useState('USD');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!headers) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const [membersRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/members`, { headers }),
        fetch(`${API_BASE}/api/admin/settings`, { headers }),
      ]);

      const membersBody = membersRes.ok
        ? ((await membersRes.json()) as { callerRole?: string })
        : { callerRole: '__denied__' };
      setCallerRole(membersBody.callerRole ?? '__denied__');

      if (!settingsRes.ok) throw new Error(`Couldn't load settings (${settingsRes.status})`);
      const settingsBody = (await settingsRes.json()) as {
        currency?: string;
        familyName?: string;
      };
      const nextCurrency = settingsBody.currency ?? 'USD';
      const nextName = settingsBody.familyName ?? '';
      setSavedCurrency(nextCurrency);
      setSavedFamilyName(nextName);
      setCurrency(nextCurrency);
      setFamilyName(nextName);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Try again.');
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  // FHS-625: admin-only, and it stays that way. Every control on this page
  // (family name, currency, export, delete the family) is admin-only on the
  // server, so there is nothing here for anyone else to read: unlike Earning
  // rules, which shows its figures to all and explains who can change them.
  // Nobody but an admin is offered the door, so reaching this by typing the
  // address means going back to the dashboard.
  useEffect(() => {
    if (callerRole === null) return;
    if (!isFamilyAdminRole(callerRole)) {
      navigate(`/t/${slug}/dashboard`, { replace: true });
    }
  }, [callerRole, slug, navigate]);

  const trimmedName = familyName.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH;
  const hasChanges = trimmedName !== savedFamilyName || currency !== savedCurrency;

  const handleSave = async () => {
    if (!headers || !nameValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (trimmedName !== savedFamilyName) {
        const res = await fetch(`${API_BASE}/api/admin/settings/familyName`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: trimmedName }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? `Couldn't save the family name (${res.status})`);
        }
        // Mark this half saved immediately: if the currency PUT below fails,
        // the name change already landed on the server and must not be lost
        // from local state (it would otherwise look unsaved and re-fire on
        // the next Save click, or silently drop if the page reloads).
        setSavedFamilyName(trimmedName);
      }
      if (currency !== savedCurrency) {
        const res = await fetch(`${API_BASE}/api/admin/settings/currency`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: currency }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? `Couldn't save the currency (${res.status})`);
        }
        setSavedCurrency(currency);
      }
      setFamilyName(trimmedName);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Careful zone: download all our data (FHS-435 GDPR export) ────────────
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!headers) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/export`, { headers });
      if (!res.ok) throw new Error(`Couldn't prepare your file (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'familyhub-export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't download your data");
    } finally {
      setExportBusy(false);
    }
  };

  // ── Careful zone: delete our family hub (FHS-435, irreversible) ──────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!headers) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/delete-account`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `Couldn't delete (${res.status})`);
      }
      await signOutAll();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your family hub");
      setDeleteBusy(false);
    }
  };

  // FHS-625: hold the page back until we know the caller is an admin, not just
  // until we know their role. The redirect above runs in an effect, one render
  // AFTER the role lands, so gating on `=== null` alone painted the family
  // name, the currency picker and the Download / Delete buttons to a non-admin
  // for a frame before bouncing them.
  if (!isFamilyAdminRole(callerRole)) {
    return (
      <div
        data-testid="family-settings-loading"
        className="flex min-h-screen items-center justify-center bg-kingdom-bg"
      >
        <p className="text-sm font-medium text-purple-200">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="family-settings-page"
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
    >
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 pb-16 sm:p-6">
        <div className="mb-4">
          <Link
            to={`/t/${slug}/dashboard`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-purple-200 hover:text-white"
            data-testid="family-settings-back-link"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="font-heading text-2xl uppercase tracking-wide text-white sm:text-3xl">
            Family settings
          </h1>
          <p className="text-sm font-medium text-purple-200">
            Things you set once and rarely change.
          </p>
        </div>

        {status === 'loading' && (
          <p data-testid="family-settings-loading-body" className="text-sm text-purple-200">
            Loading settings…
          </p>
        )}
        {status === 'error' && (
          <Card testId="family-settings-error" className="border-red-400 bg-red-50">
            <p className="text-sm font-bold text-red-700">{errorMessage}</p>
          </Card>
        )}

        {status === 'ready' && (
          <div className="flex flex-col gap-5" data-testid="family-settings-ready">
            {/* Cross-link: says plainly where the everyday controls are, so
                nobody hunts here for what a sticker is worth. */}
            <Card variant="cyan" testId="family-settings-earning-rules-banner">
              <p className="flex items-start gap-2 text-sm font-bold">
                <Compass size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Looking for what a sticker is worth, or what happens on a skipped day? Those live
                  in{' '}
                  <Link
                    to={`/t/${slug}/reward-settings`}
                    className="underline decoration-2 underline-offset-2"
                    data-testid="family-settings-earning-rules-link"
                  >
                    Earning rules
                  </Link>
                  .
                </span>
              </p>
            </Card>

            <Card testId="family-settings-name-card">
              <h2 className="font-heading text-lg uppercase tracking-wide text-gray-900">
                Your family hub
              </h2>
              <p className="mt-1 text-sm font-bold text-gray-600">
                The name everyone sees at the top of the app.
              </p>

              <div className="mt-4">
                <Label htmlFor="family-settings-name-input">Family name</Label>
                <input
                  id="family-settings-name-input"
                  data-testid="family-settings-name-input"
                  value={familyName}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(event) => setFamilyName(event.target.value)}
                  className="min-h-[48px] w-full rounded-xl border-2 border-black p-3 font-bold shadow-neo-xs focus:outline-none focus:ring-4 focus:ring-cyan-200"
                />
                {!nameValid && (
                  <p
                    data-testid="family-settings-name-error"
                    className="mt-1.5 text-xs font-bold text-red-600"
                  >
                    Give your family a name so it can be saved.
                  </p>
                )}
              </div>
            </Card>

            <Card testId="family-settings-currency-card">
              <h2 className="font-heading text-lg uppercase tracking-wide text-gray-900">
                Money shown as
              </h2>
              <p className="mt-1 text-sm font-bold text-gray-600">
                Every amount in the app uses this. Changing it does not convert what is already
                there.
              </p>

              <div className="mt-4">
                <Label htmlFor="family-settings-currency-trigger">Currency</Label>
                <CurrencyPicker
                  id="family-settings-currency-trigger"
                  value={currency}
                  onChange={setCurrency}
                  testId="family-settings-currency"
                />
                <p
                  data-testid="family-settings-currency-preview"
                  className="mt-2 text-xs font-bold text-gray-500"
                >
                  Example: {formatMoney(CURRENCY_PREVIEW_AMOUNT, currency)}
                </p>
              </div>
            </Card>

            <div>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={saving || !nameValid || !hasChanges}
                onClick={() => void handleSave()}
                testId="family-settings-save-btn"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {saveError && (
                <p
                  data-testid="family-settings-save-error"
                  className="mt-2 text-sm font-bold text-red-700"
                >
                  {saveError}
                </p>
              )}
              {savedAt && !saveError && (
                <p
                  role="status"
                  data-testid="family-settings-saved-notice"
                  className="mt-2 text-sm font-bold text-green-700"
                >
                  Saved at {new Date(savedAt).toLocaleTimeString()}. Everyone in the family sees
                  this straight away.
                </p>
              )}
            </div>

            {/* ── Careful zone: hard to undo, fenced away from daily use ── */}
            <Card testId="family-settings-careful-zone" className="overflow-hidden !p-0">
              <div className="flex items-center gap-2 border-b-2 border-black bg-gray-100 px-5 py-3">
                <AlertTriangle size={18} aria-hidden="true" />
                <h2 className="font-heading text-base uppercase tracking-wide text-gray-900">
                  Careful zone
                </h2>
              </div>

              <div className="flex flex-col gap-4 p-5">
                <p className="text-sm font-bold text-gray-600">
                  These two are hard to undo, so each one asks first.
                </p>

                {/* Download all our data */}
                <div className="rounded-xl border-2 border-black bg-gray-50 p-4">
                  <h3 className="font-heading text-base text-gray-900">Download all our data</h3>
                  <p className="mt-1 text-sm font-bold text-gray-600">
                    A file with every habit, meal, event and sticker balance for the whole family.
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={exportBusy}
                      onClick={() => void handleExport()}
                      testId="family-settings-export-btn"
                    >
                      <Download size={16} aria-hidden="true" />
                      <span className="ml-1.5">
                        {exportBusy ? 'Preparing…' : 'Download our data'}
                      </span>
                    </Button>
                  </div>
                  {exportError && (
                    <p
                      data-testid="family-settings-export-error"
                      className="mt-2 text-sm font-bold text-red-700"
                    >
                      {exportError}
                    </p>
                  )}
                </div>

                {/* Delete our family hub */}
                <div className="rounded-xl border-2 border-black bg-red-50 p-4">
                  <h3 className="font-heading text-base text-gray-900">Delete our family hub</h3>
                  <p className="mt-1 text-sm font-bold text-gray-700">
                    This removes every member, habit, meal, event and sticker balance for everyone.
                    It cannot be brought back, and nobody in the family will be able to sign in
                    again.
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="danger"
                      size="md"
                      onClick={() => {
                        setDeleteConfirmText('');
                        setDeleteError(null);
                        setDeleteOpen(true);
                      }}
                      testId="family-settings-delete-btn"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span className="ml-1.5">Delete our family hub</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        variant="danger"
        title="Delete our family hub?"
        message={
          <>
            This <strong>permanently deletes {savedFamilyName || 'your family'}</strong> and every
            member, task, meal, event, habit and record inside it. This cannot be undone.
          </>
        }
        confirmLabel="Delete forever"
        busy={deleteBusy}
        confirmDisabled={!savedFamilyName || deleteConfirmText.trim() !== savedFamilyName.trim()}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
        testId="family-settings-delete-confirm"
      >
        <div className="mt-4">
          <label
            htmlFor="family-settings-delete-confirm-input"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-500"
          >
            Type{' '}
            <span
              data-testid="family-settings-delete-family-name"
              className="font-black text-gray-900"
            >
              {savedFamilyName || '…'}
            </span>{' '}
            to confirm
          </label>
          <input
            id="family-settings-delete-confirm-input"
            data-testid="family-settings-delete-confirm-input"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            className="min-h-[48px] w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 font-bold text-gray-900 outline-none focus:border-red-400"
          />
          {deleteError && (
            <p
              data-testid="family-settings-delete-error"
              className="mt-2 text-sm font-bold text-red-700"
            >
              {deleteError}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
