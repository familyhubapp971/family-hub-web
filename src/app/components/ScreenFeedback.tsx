/**
 * ScreenFeedback: FHS-670
 *
 * A floating "Feedback" button at the bottom of every signed-in parent screen. It asks
 * the homepage survey's questions about the screen the parent is on, lets them
 * tap which of that screen's features they mean, and saves the answer with the
 * screen and a per-visit ID so the export can group one person's visit.
 *
 * FHS-671: the founder asked for it at the bottom of the screen, with a speech
 * bubble that pops up on every screen or tab change to say feedback is
 * possible here. FHS-434 once removed a floating button because it covered
 * content, so while it shows, every page gets extra room at the end
 * (`fh-feedback-fab` in index.css), and it sits above Reward settings' save
 * bar. The homepage survey (BetaFeedbackWidget) is separate and unchanged.
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button, Dialog } from '@familyhub/ui';
import { isGrownUpRole } from '@familyhub/shared';
import { useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';
import {
  getVisitId,
  screenFeedbackByKey,
  screenFeedbackFor,
  type ScreenFeedbackConfig,
} from '../lib/screen-feedback';
import { CountedTextarea, RatingRow } from './BetaFeedbackWidget';

const HINT_MS = 5000;

interface ScreenFeedbackProps {
  /** The caller's role in this family; null while it loads. Grown-ups only. */
  role: string | null;
  /** Set by screens whose tab is not in the URL (Child World). */
  screenKey?: string;
}

export function ScreenFeedback({ role, screenKey }: ScreenFeedbackProps) {
  const { session } = useAuth();
  const { slug } = useParams<{ slug?: string }>();
  const location = useLocation();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  // Fixed when the dialog opens, so switching tab behind it cannot relabel it.
  const [screen, setScreen] = useState<ScreenFeedbackConfig | null>(null);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [solves, setSolves] = useState<number | undefined>();
  const [ease, setEase] = useState<number | undefined>();
  const [keep, setKeep] = useState<number | undefined>();
  const [wish, setWish] = useState('');
  const [other, setOther] = useState('');

  const visible = Boolean(session && slug && isGrownUpRole(role));
  const current = screenKey
    ? screenFeedbackByKey(screenKey)
    : screenFeedbackFor(location.pathname, location.search);

  // The bubble pops up each time the parent lands on a screen or tab.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setHint(true);
    const timer = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, [visible, current.key, location.pathname, location.search]);

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('fh-feedback-fab');
    return () => document.body.classList.remove('fh-feedback-fab');
  }, [visible]);

  const hasAnswer =
    solves !== undefined ||
    ease !== undefined ||
    keep !== undefined ||
    wish.trim() !== '' ||
    other.trim() !== '';

  const handleOpen = useCallback(() => {
    setHint(false);
    setScreen(current);
    setFeatures([]);
    setSolves(undefined);
    setEase(undefined);
    setKeep(undefined);
    setWish('');
    setOther('');
    setState('idle');
    setErrorMsg('');
    setOpen(true);
  }, [current]);

  const handleClose = useCallback(() => setOpen(false), []);

  const toggleFeature = useCallback((name: string) => {
    setFeatures((cur) => (cur.includes(name) ? cur.filter((f) => f !== name) : [...cur, name]));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!screen || !hasAnswer || state === 'submitting') return;
    setState('submitting');
    setErrorMsg('');

    const body: Record<string, unknown> = {
      screen: screen.key,
      visitId: getVisitId(),
    };
    if (features.length > 0) body.features = features;
    if (solves !== undefined) body.solvesProblem = solves;
    if (ease !== undefined) body.easeOfUse = ease;
    if (keep !== undefined) body.keepUsing = keep;
    if (wish.trim()) body.featureRequest = wish.trim();
    if (other.trim()) body.otherFeedback = other.trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    if (slug) headers['x-tenant-slug'] = slug;

    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setState('success');
        return;
      }
      let msg = 'Something went wrong. Please try again.';
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        // keep the default message
      }
      setState('error');
      setErrorMsg(msg);
    } catch {
      setState('error');
      setErrorMsg('Could not reach the server. Check your connection and try again.');
    }
  }, [screen, hasAnswer, state, features, solves, ease, keep, wish, other, session, slug]);

  // Grown-ups only. A child signs in with a kid token, never a parent session,
  // and a teen with an account has a kid role. Hidden while the role loads.
  if (!visible) return null;

  // Rendered into <body> so no header styling can pin the fixed button.
  const corner = createPortal(
    <div
      className={[
        'fixed right-4 z-40 flex flex-col items-end gap-2 sm:right-6',
        current.raised ? 'bottom-24' : 'bottom-4 sm:bottom-6',
      ].join(' ')}
    >
      {/* The bubble below is for sighted mouse and touch users; this reads the
          same sentence to screen readers, and the Feedback button is the
          keyboard route in. */}
      <p role="status" className="sr-only" data-testid="screen-feedback-announce">
        {hint && !open ? `You can give feedback on ${current.area} here.` : ''}
      </p>
      {hint && !open && (
        <button
          type="button"
          onClick={handleOpen}
          aria-hidden="true"
          tabIndex={-1}
          data-testid="screen-feedback-hint"
          className="relative max-w-[240px] rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-left text-sm font-bold text-black shadow-neo-sm motion-safe:animate-menu-drop"
        >
          You can give feedback on {current.area} here.
          <span
            aria-hidden="true"
            className="absolute -bottom-2 right-6 h-3.5 w-3.5 rotate-45 border-b-2 border-r-2 border-black bg-white"
          />
        </button>
      )}
      <button
        type="button"
        aria-label="Feedback on this screen"
        onClick={handleOpen}
        data-testid="screen-feedback-button"
        className={[
          'flex min-h-[48px] items-center gap-2 rounded-2xl border-2 border-black bg-pink-400 px-4 py-3',
          'text-sm font-black text-black shadow-neo transition-all duration-150',
          'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-neo-md',
          'active:translate-y-1 active:shadow-none',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-600 focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Feedback</span>
      </button>
    </div>,
    document.body,
  );

  return (
    <>
      {corner}

      <Dialog
        isOpen={open}
        onClose={handleClose}
        testId="screen-feedback-dialog"
        ariaLabelledBy={titleId}
      >
        {/* FHS-678: the card fits the visible screen. The header stays put and
            only the body scrolls, so the close button is always in reach. */}
        <div
          className="relative flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-black bg-white shadow-neo-lg supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]"
          data-testid="screen-feedback-card"
        >
          <div
            className="relative shrink-0 border-b-2 border-black bg-pink-400 px-5 py-4 pr-16"
            data-testid="screen-feedback-header"
          >
            <h2 id={titleId} className="font-display text-xl font-black text-black">
              Feedback on this screen
            </h2>
            <p
              className="mt-0.5 text-sm font-medium text-black/80"
              data-testid="screen-feedback-area"
            >
              Tell us how {screen?.area} is working for you (takes ~1 min).
            </p>
            <button
              type="button"
              aria-label="Close feedback dialog"
              onClick={handleClose}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-yellow-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-600"
            >
              <span aria-hidden="true" className="block h-5 w-5 text-center font-black leading-5">
                ✕
              </span>
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            data-testid="screen-feedback-body"
          >
            {state === 'success' ? (
              <div
                className="flex flex-col items-center gap-4 px-5 py-10 text-center"
                data-testid="screen-feedback-thanks"
              >
                <span className="text-5xl" aria-hidden="true">
                  🎉
                </span>
                <h3 className="font-display text-2xl font-black">Thank you!</h3>
                <p className="text-gray-700">
                  Your feedback on {screen?.area} helps us build a better Family Hub.
                </p>
                <Button onClick={handleClose} variant="primary">
                  Close
                </Button>
              </div>
            ) : screen ? (
              <div className="space-y-6 px-5 py-5">
                {screen.features.length > 0 && (
                  <fieldset>
                    <legend className="mb-2 font-black text-sm text-black">
                      Which part are you thinking of?
                      <span className="ml-1 font-normal text-gray-400">(optional)</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {screen.features.map((name) => {
                        const selected = features.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleFeature(name)}
                            data-testid="screen-feedback-feature"
                            className={[
                              'min-h-[44px] rounded-full border-2 border-black px-4 py-2 text-sm font-bold transition-all',
                              'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                              selected
                                ? 'bg-pink-400 text-black shadow-neo-sm'
                                : 'bg-white text-black hover:bg-yellow-100',
                            ].join(' ')}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <fieldset>
                  <legend className="mb-2 font-black text-sm text-black">
                    How well does {screen.area} solve a real problem for your family?
                    <span className="ml-1 font-normal text-gray-400">(optional)</span>
                  </legend>
                  <RatingRow
                    max={5}
                    value={solves}
                    onChange={(n) => setSolves(solves === n ? undefined : n)}
                    lowLabel="Not at all"
                    highLabel="Extremely well"
                    testIdPrefix="screen-feedback-solves"
                  />
                </fieldset>

                <fieldset>
                  <legend className="mb-2 font-black text-sm text-black">
                    How easy is {screen.area} to use?
                    <span className="ml-1 font-normal text-gray-400">(optional)</span>
                  </legend>
                  <RatingRow
                    max={5}
                    value={ease}
                    onChange={(n) => setEase(ease === n ? undefined : n)}
                    lowLabel="Very hard"
                    highLabel="Very easy"
                    testIdPrefix="screen-feedback-ease"
                  />
                </fieldset>

                <fieldset>
                  <legend className="mb-2 font-black text-sm text-black">
                    After the beta, how likely are you to keep using {screen.area}?
                    <span className="ml-1 font-normal text-gray-400">(optional)</span>
                  </legend>
                  <RatingRow
                    max={5}
                    value={keep}
                    onChange={(n) => setKeep(keep === n ? undefined : n)}
                    lowLabel="Not likely"
                    highLabel="Definitely"
                    testIdPrefix="screen-feedback-keep"
                  />
                </fieldset>

                <div>
                  <label
                    htmlFor="screen-feedback-wish"
                    className="mb-1 block font-black text-sm text-black"
                  >
                    What&apos;s one thing you wish {screen.area} had?
                    <span className="ml-1 font-normal text-gray-400">(optional)</span>
                  </label>
                  <CountedTextarea
                    id="screen-feedback-wish"
                    testId="screen-feedback-wish"
                    rows={3}
                    value={wish}
                    onChange={setWish}
                    placeholder={`e.g. ${screen.wishExample}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="screen-feedback-other"
                    className="mb-1 block font-black text-sm text-black"
                  >
                    Anything else about {screen.area}?
                    <span className="ml-1 font-normal text-gray-400">(optional)</span>
                  </label>
                  <CountedTextarea
                    id="screen-feedback-other"
                    testId="screen-feedback-other"
                    rows={3}
                    value={other}
                    onChange={setOther}
                    placeholder="Anything else on your mind…"
                  />
                </div>

                {state === 'error' && (
                  <p
                    role="alert"
                    data-testid="screen-feedback-error"
                    className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {errorMsg}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 border-t-2 border-black pt-4">
                  <p className="text-xs text-gray-500">Answer at least one question to submit.</p>
                  <Button
                    variant="primary"
                    disabled={!hasAnswer || state === 'submitting'}
                    onClick={handleSubmit}
                    testId="screen-feedback-submit"
                  >
                    {state === 'submitting' ? 'Sending…' : 'Send feedback'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Dialog>
    </>
  );
}
