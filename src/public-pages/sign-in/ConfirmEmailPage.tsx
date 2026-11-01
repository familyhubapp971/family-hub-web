import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, MailX, Mail, AlertTriangle } from 'lucide-react';
import { Button, Card, Spinner } from '@familyhub/ui';
import { apiFetch, ApiError } from '../../app/lib/api';

// FHS-510: the landing page for a self-serve sign-in email change.
// A grown-up sets a new email for their OWN account on Manage Members; a
// one-time link is emailed to the NEW address; clicking it lands here and
// applies the change. Root-level route (outside ProtectedRoute): the person
// clicking may not be signed in at all.
//
// Five states:
//   ready    : the token is present in the URL; waits for an explicit tap
//              before firing the confirm request (see below).
//   checking : spinner while the confirm request is in flight.
//   done     : the change applied; shows the new email + a way back in.
//   expired  : the link is missing/used/expired; nothing was changed.
//   error    : a transient failure (Supabase hiccup, network drop, or a
//              post-apply drift), NOT "expired". The token may still be
//              good, so this offers a retry instead of "ask for a new link".
//
// SECURITY: click-to-confirm, not auto-fire-on-mount: corporate email
// link-scanners (Microsoft Safe Links, Proofpoint, etc.) prefetch every URL
// in an email before the recipient ever opens it. If this page fired the
// POST inside a useEffect on mount, the scanner's prefetch would consume the
// single-use token and the real recipient would land on "expired" for a
// link they never got to click. Gating the POST behind an explicit button
// tap means only a human click can spend the token.

interface ConfirmResponse {
  newEmail: string;
  memberName: string;
  tenantSlug: string | null;
}

type Status =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'done'; newEmail: string; memberName: string; tenantSlug: string | null }
  | { kind: 'expired' }
  | { kind: 'error' };

export function ConfirmEmailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const token = params.get('token');
  // No token/memberId at all: there's nothing to confirm, so skip straight
  // to "expired" rather than showing a button that can never work.
  const [status, setStatus] = useState<Status>(
    memberId && token ? { kind: 'ready' } : { kind: 'expired' },
  );

  function onConfirm() {
    if (!memberId || !token) {
      setStatus({ kind: 'expired' });
      return;
    }
    setStatus({ kind: 'checking' });
    apiFetch<ConfirmResponse>('/api/members/email-change/confirm', {
      method: 'POST',
      anonymous: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, token }),
    })
      .then((body) => {
        setStatus({
          kind: 'done',
          newEmail: body.newEmail,
          memberName: body.memberName,
          tenantSlug: body.tenantSlug,
        });
      })
      .catch((err: unknown) => {
        // 410 = the link is genuinely missing/used/expired. Anything else
        // (network drop, 502 Supabase hiccup, 500 post-apply drift) is a
        // TRANSIENT failure: the token may still be good, so "try again"
        // is the honest message, not "ask for a new link".
        if (err instanceof ApiError && err.status === 410) {
          setStatus({ kind: 'expired' });
        } else {
          setStatus({ kind: 'error' });
        }
      });
  }

  function backToFamily() {
    if (status.kind === 'done' && status.tenantSlug) {
      navigate(`/t/${status.tenantSlug}/dashboard`);
    } else {
      navigate('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kingdom-bg p-6 font-body">
      <Card className="flex w-full max-w-md flex-col items-center bg-white p-8 text-center md:p-12">
        {/* Screen readers announce each state change (ready → checking →
            done/expired/error) as the content inside swaps. */}
        <div
          role="status"
          aria-live="polite"
          className="flex w-full flex-col items-center"
          data-testid="confirm-email-status-region"
        >
          {status.kind === 'ready' && (
            <>
              <IconDisc bg="bg-yellow-100" reduceMotion={!!reduceMotion}>
                <Mail className="text-black" size={32} aria-hidden="true" />
              </IconDisc>
              <h1 className="mb-4 font-heading text-3xl">Confirm your new email</h1>
              <p className="mb-8 font-bold text-gray-600">
                You asked to update your Family Hub sign-in email. Tap below to confirm it.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={onConfirm}
                testId="confirm-email-confirm"
              >
                Confirm email change
              </Button>
            </>
          )}

          {status.kind === 'checking' && (
            <>
              <IconDisc bg="bg-yellow-100" reduceMotion={!!reduceMotion}>
                <Spinner size="lg" className="text-black" testId="confirm-email-spinner" />
              </IconDisc>
              <h1 className="mb-2 font-heading text-3xl">Checking your link</h1>
              <p className="font-bold text-gray-600">One moment&hellip;</p>
            </>
          )}

          {status.kind === 'done' && (
            <>
              <IconDisc bg="bg-emerald-100" reduceMotion={!!reduceMotion}>
                <Check className="text-black" size={32} aria-hidden="true" />
              </IconDisc>
              <h1 className="mb-4 font-heading text-3xl">Email updated</h1>
              <p className="mb-1 font-bold text-gray-600">{status.memberName} now signs in with</p>
              <p
                className="mb-8 break-all font-heading text-xl text-black"
                data-testid="confirm-email-new-address"
              >
                {status.newEmail}
              </p>
              <Button
                type="button"
                variant="purple"
                size="lg"
                fullWidth
                onClick={backToFamily}
                testId="confirm-email-back"
              >
                Back to the family
              </Button>
            </>
          )}

          {status.kind === 'expired' && (
            <>
              <IconDisc bg="bg-gray-100" reduceMotion={!!reduceMotion}>
                <MailX className="text-gray-500" size={32} aria-hidden="true" />
              </IconDisc>
              <h1 className="mb-4 font-heading text-3xl">This link has expired</h1>
              <p className="mb-8 font-bold text-gray-600">
                It may already have been used, or the change was cancelled. Ask an admin to send a
                new one.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                onClick={backToFamily}
                testId="confirm-email-back"
              >
                Back to the family
              </Button>
            </>
          )}

          {status.kind === 'error' && (
            <>
              <IconDisc bg="bg-orange-100" reduceMotion={!!reduceMotion}>
                <AlertTriangle className="text-orange-600" size={32} aria-hidden="true" />
              </IconDisc>
              <h1 className="mb-4 font-heading text-3xl">Something went wrong</h1>
              <p className="mb-8 font-bold text-gray-600">
                We couldn&rsquo;t confirm the change. Please try the link again in a moment.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={onConfirm}
                testId="confirm-email-retry"
              >
                Try again
              </Button>
              <button
                type="button"
                onClick={backToFamily}
                className="mt-3 inline-block py-3 px-3 text-sm font-bold text-purple-600 transition-colors hover:text-purple-800"
                data-testid="confirm-email-back"
              >
                Back to the family
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function IconDisc({
  bg,
  reduceMotion,
  children,
}: {
  bg: string;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black shadow-neo-sm ${bg}`}
      aria-hidden="true"
      initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
