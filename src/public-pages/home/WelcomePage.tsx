import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  BookOpen,
  NotebookPen,
  LayoutDashboard,
  Users,
  Settings,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import {
  Button,
  DynamicCalendar,
  FeatureCard,
  FloatingDecorations,
  type FloatingDecoration,
} from '@familyhub/ui';
import { useAuth, signOutAll, getKidToken } from '../../app/lib/auth-context';
import { API_BASE } from '../../app/lib/api';
import { BetaFeedbackWidget } from '../../app/components/BetaFeedbackWidget';
import { SiteHeader, SiteFooter, MAIN_CONTENT_ID } from '../SiteChrome';

// Hero copy rotates between four ad pitches every 5 seconds, each
// targeting a different persona:
//   - Slide 1: pitch to the COORDINATING parent (Sarah persona):
//     someone evaluating Family Hub to fix the mental load of running
//     a household.
//   - Slide 2: pitch to the INVITED parent (Yusuf persona): someone
//     receiving the link from their partner. The inviter's name cycles
//     every 1.5s through a culturally diverse set so this slide reads
//     as "your partner just sent you a link" regardless of who's
//     looking: Sarah / Aisha / Sandra / Priya / etc.
//   - Slide 3: pitch to the parent of a KID (Sarah-as-mum view): a
//     kid name cycles, framing the app as the place where the kid
//     racks up streaks for chores + lessons + rewards.
//   - Slide 4: pitch to DADS as active participants (Yusuf-but-leading):
//     the dad name cycles. Aspirational, not duty-coded: implies
//     dads want IN on the wins (school run, bedtime, weekend plans),
//     not just ticking admin boxes.
// Source design: Magic Patterns kudjspxd3xxroueg5jw11o pages/Welcome.tsx.

const inviterNames = [
  'Jumi',
  'Sandra',
  'Aisha',
  'Maria',
  'Priya',
  'Emma',
  'Fatima',
  'Sofia',
  'Yara',
  'Olivia',
  'Sarah',
  'Mei',
] as const;

// Kid names: culturally diverse to mirror the inviter set. Used by
// the third slide to cycle through "<Kid> just earned their streak".
const kidNames = ['Iman', 'Faith', 'Noah', 'Ibrahim'] as const;

// Dad names: culturally diverse, used by the fourth slide. Pitched
// as the dad LEADING moments (school run, bedtime, weekend wins),
// not just receiving an invite from his partner.
const dadNames = ['Yusuf', 'Marcus', 'Olu', 'Raj', 'James', 'Mohammed'] as const;

const slides = [
  {
    id: 'sarah',
    headline: 'Your whole family, finally in sync.',
    subtitle:
      "One beautifully calm place for the schedules, tasks, meals, and learning that make family life hum, so everyone wakes up knowing what's on.",
    // Copy length matched across all 3 slides (~20 chars) so the CTA
    // button doesn't visibly resize during the cross-fade transition.
    cta: 'Start your free trial',
  },
  {
    // 'invited-parent' = the secondary-parent ad slide (Yusuf-style
    // persona). Internal id; never shown to the user. Headline is
    // built dynamically from inviterNames so the partner name flashes
    // through several options while this slide is up, depicting a
    // wife inviting her husband to share the family's mental load.
    id: 'invited-parent',
    headline: null,
    subtitle:
      "From this week's meals to the kids' assignments, you'll both be looking at the same plan. Tap the link. Let's run the week together.",
    cta: 'Join the family team',
  },
  {
    // 'kid' = parent-of-kid pitch. The kid name cycles through
    // kidNames so the slide reads as "your kid is the one earning
    // streaks here". Subtitle weaves the three concrete things kids
    // actually do in the app: lessons, chores, rewards (mirrors the
    // FeatureCards below).
    id: 'kid',
    headline: null,
    subtitle:
      'Lessons done, chores ticked, rewards unlocked: your kids see their own week, build streaks, and feel proud without you nagging.',
    cta: 'Add your kids today',
  },
  {
    // 'dad' = pitch dads as active participants. Aspirational, not
    // duty-coded: the headline frames the dad LANDING a moment
    // (school run / bedtime story / weekend plan) so the read is
    // "be the dad who's in the wins", not "here's another chore app".
    id: 'dad',
    headline: null,
    subtitle:
      'Be the dad your kids notice, not because you nagged, but because you showed up. Family Hub puts the wins on your radar so you can land them.',
    cta: 'Get in the loop',
  },
] as const;

// Calendar slot is a live component (always shows today's date) instead
// of the 📅 emoji, which is hard-coded to "JUL 17" by the OS glyph and
// looks stale on any other day. Positioned a little lower than the
// emoji-only set so the calendar doesn't crowd the brand link in the
// top-left corner of the hero.
const floatingElements: FloatingDecoration[] = [
  {
    icon: <DynamicCalendar testId="welcome-floating-calendar" />,
    top: '30%',
    left: '8%',
    delay: 0,
  },
  { icon: '✅', top: '60%', left: '15%', delay: 1 },
  { icon: '⭐', top: '20%', right: '12%', delay: 0.5 },
  { icon: '🏠', top: '65%', right: '15%', delay: 1.5 },
];

const featureCards = [
  {
    accentBar: 'border-l-pink-400',
    headerBg: 'bg-yellow-200',
    cardBg: 'bg-yellow-50',
    iconColor: 'text-pink-500',
    Icon: Calendar,
    title: 'One calendar, every child',
    body: "School runs, swim class, dentist: see everyone's schedule in one place. Color-coded by kid.",
  },
  {
    accentBar: 'border-l-green-500',
    headerBg: 'bg-lime-200',
    cardBg: 'bg-lime-50',
    iconColor: 'text-green-600',
    Icon: CheckSquare,
    title: 'Tasks that actually stick',
    body: 'Assign chores, track habits, reward effort. No more nagging. The app does it for you.',
  },
  {
    accentBar: 'border-l-blue-500',
    headerBg: 'bg-cyan-200',
    cardBg: 'bg-cyan-50',
    iconColor: 'text-blue-600',
    Icon: BookOpen,
    title: 'Curious minds, every day',
    body: 'Quran, math, languages, world flags: culturally aware defaults baked in. Bite-sized, kid-friendly, parent-tracked.',
  },
  {
    accentBar: 'border-l-orange-400',
    headerBg: 'bg-pink-200',
    cardBg: 'bg-pink-50',
    iconColor: 'text-orange-500',
    Icon: NotebookPen,
    title: 'Memories that last',
    body: "A shared family journal: milestones, gratitude, the funny things the kids said. Your family's story, safe in one place.",
  },
] as const;

export function WelcomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [inviterIdx, setInviterIdx] = useState(0);
  const [kidIdx, setKidIdx] = useState(0);
  const [dadIdx, setDadIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  // FHS-358: the homepage reflects logged-in state. An adult is logged in via
  // the Supabase session; a kid via the fh.kid.token (no Supabase session).
  const { session, loading: authLoading } = useAuth();
  // getKidToken validates the JWT's expiry (and drops it if stale), so an
  // expired kid session doesn't wrongly show the logged-in homepage.
  const kidToken = useMemo(() => getKidToken(), []);
  const loggedInAdult = !!session;
  const loggedInKid = !session && !!kidToken;
  const loggedIn = loggedInAdult || loggedInKid;

  // Adult home data (family + children) for the logged-in landing.
  // undefined while loading; null if it could not load.
  const [home, setHome] = useState<AdultHome | null | undefined>(undefined);
  useEffect(() => {
    if (!loggedInAdult || !session) return;
    let cancelled = false;
    void loadAdultHome(session.access_token).then((h) => {
      if (!cancelled) setHome(h);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedInAdult, session]);

  const kidFamily = useMemo(() => (loggedInKid ? readKidFamily() : null), [loggedInKid]);

  const onLogout = useCallback(async () => {
    await signOutAll();
    // Adult: the AuthProvider clears the session reactively. Kid: there's no
    // reactive store for the kid token, so reload to re-read auth from scratch.
    window.location.assign('/');
  }, []);

  // Auto-rotate slides every 5s. Skipped under prefers-reduced-motion and when
  // logged in (the rotating ad hero isn't shown then).
  useEffect(() => {
    if (reduceMotion || loggedIn) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [reduceMotion, loggedIn]);

  // Fast-cycle the partner name on the invited-parent slide so the
  // headline reads as "your partner just sent you a link" across many
  // cultures. Only ticks while that slide is visible. Resets to index
  // 0 (Jumi) every time the slide becomes visible so the cycle always
  // STARTS with Jumi rather than whatever value it left off on.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'invited-parent') return;
    setInviterIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setInviterIdx((prev) => (prev + 1) % inviterNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  // Same cycling pattern for the kid slide: name flashes through
  // Iman / Faith / Noah / Ibrahim while the slide is up.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'kid') return;
    setKidIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setKidIdx((prev) => (prev + 1) % kidNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  // Same cycling pattern for the dad slide: name flashes through
  // Yusuf / Marcus / Olu / Raj / James / Mohammed while the slide is up.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'dad') return;
    setDadIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setDadIdx((prev) => (prev + 1) % dadNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  const slide = slides[currentSlide]!;
  const inviterName = inviterNames[inviterIdx]!;
  const kidName = kidNames[kidIdx]!;
  const dadName = dadNames[dadIdx]!;

  // Logged-in landing/header values (adult or kid).
  const homeSlug = loggedInAdult ? home?.slug || undefined : kidFamily?.slug;
  const homeDashboardPath = homeSlug ? `/t/${homeSlug}/dashboard` : '/dashboard';
  const homeLabel = (loggedInAdult ? home?.familyName : kidFamily?.name) ?? 'My family';
  const homeInitial = homeLabel.charAt(0).toUpperCase();

  // While the Supabase session is still restoring, don't render the logged-out
  // hero: it would flash (and on a slow token refresh, stick) for a returning
  // user, which is exactly the "homepage shows logged-out" bug. A kid is known
  // synchronously (kidToken), so we don't make them wait.
  if (authLoading && !kidToken) {
    return (
      <div
        data-testid="welcome-auth-loading"
        className="flex h-screen items-center justify-center bg-kingdom-bg font-heading text-2xl text-white"
      >
        FamilyHub
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-kingdom-bg font-body text-white">
      {/* Subtle radial purple glow at the top of the hero. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.4),rgba(61,16,101,0)_60%)]" />

      {/* Floating decorative emojis: hidden on mobile, motion-safe. */}
      <FloatingDecorations elements={floatingElements} />

      {/* Header: kept slim so the hero + feature cards both fit
          above the fold on a 1080p viewport. */}
      {/* FHS-544: the homepage uses the shared SiteHeader so it matches the
          legal + marketing pages exactly (no drift). FHS-555: the logged-in
          variant now passes its profile pill + logout as `actions` rather
          than keeping a second header, so both get the burger menu. */}
      <SiteHeader
        current="features"
        {...(loggedIn
          ? {
              actions: (
                <div
                  className="flex items-center gap-2 md:gap-3"
                  data-testid="welcome-loggedin-actions"
                >
                  <button
                    type="button"
                    onClick={() => navigate(homeDashboardPath)}
                    aria-label={`Go to ${homeLabel} dashboard`}
                    data-testid="welcome-profile-pill"
                    className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-black bg-[#4a1578] py-1.5 pl-1.5 pr-3 shadow-neo-xs transition-transform hover:bg-[#5a1d8a] motion-safe:hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-pink-300 font-heading text-black"
                    >
                      {homeInitial}
                    </span>
                    <span className="hidden text-sm font-bold uppercase tracking-wide sm:inline">
                      {homeLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    aria-label="Log out"
                    data-testid="welcome-logout"
                    className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border-2 border-black bg-red-500 px-3 py-2 font-bold text-white shadow-neo-sm transition-transform hover:bg-red-600 motion-safe:hover:-translate-y-0.5"
                  >
                    <LogOut size={16} strokeWidth={3} aria-hidden="true" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ),
            }
          : {})}
      />

      {/* FHS-358: logged-in landing replaces the ad hero. */}
      {loggedIn && (
        <LoggedInLanding
          navigate={navigate}
          dashboardPath={homeDashboardPath}
          familyLabel={homeLabel}
          slug={homeSlug}
          kids={loggedInAdult ? (home?.children ?? []) : []}
          isKid={loggedInKid}
          loading={loggedInAdult && home === undefined}
          setupPath={loggedInAdult ? (home?.setupPath ?? null) : null}
          reduceMotion={!!reduceMotion}
        />
      )}

      {/* Hero: flex-1 absorbs leftover viewport height; gap controls
          vertical rhythm without pushing the feature row off-screen.
          Logged-out only, logged-in users get LoggedInLanding above. */}
      {!loggedIn && (
        <main
          id={MAIN_CONTENT_ID}
          className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5 px-6 pb-6 pt-8 text-center md:pt-6"
        >
          {/* Cross-fading slide area */}
          <div className="relative flex min-h-[180px] w-full flex-col items-center justify-center md:min-h-[200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <h1 className="mb-3 font-heading text-3xl leading-tight text-yellow-300 md:text-5xl lg:text-6xl">
                  {slide.id === 'invited-parent' ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={inviterName}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.25 }}
                          className="inline-block text-pink-300"
                        >
                          {inviterName}
                        </motion.span>
                      </AnimatePresence>{' '}
                      just teamed up with you on family life.
                    </>
                  ) : slide.id === 'kid' ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={kidName}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.25 }}
                          className="inline-block text-pink-300"
                        >
                          {kidName}
                        </motion.span>
                      </AnimatePresence>{' '}
                      just earned their streak this week.
                    </>
                  ) : slide.id === 'dad' ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={dadName}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.25 }}
                          className="inline-block text-pink-300"
                        >
                          {dadName}
                        </motion.span>
                      </AnimatePresence>{' '}
                      just won three rounds of dad-of-the-week.
                    </>
                  ) : (
                    slide.headline
                  )}
                </h1>
                <p className="max-w-2xl text-base font-bold text-purple-100 md:text-lg">
                  {slide.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <Button
            onClick={() => navigate('/signup')}
            variant="primary"
            size="lg"
            className="px-6 py-3 text-base md:text-lg"
          >
            {slide.cta}
          </Button>

          {/* Slider dots */}
          <div className="flex items-center gap-3">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                className="grid min-h-[44px] min-w-[44px] place-items-center p-3 -m-3"
                aria-label={`Go to slide ${idx + 1}`}
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full transition-colors ${
                    currentSlide === idx ? 'bg-yellow-300' : 'bg-purple-400 hover:bg-purple-300'
                  }`}
                />
              </button>
            ))}
          </div>

          <p className="text-sm font-bold text-purple-200">
            Trusted by 2,400+ families in UAE, UK &amp; US
          </p>

          {/* Feature cards: 4 pillars: Calendar, Tasks, Learn, Journal.
            Cultural angle woven into the Learn card description.
            FHS-558: the h2 gives the card h3s a parent level so the
            heading outline never skips. Visually hidden because the
            design deliberately runs the cards straight off the hero. */}
          <h2 className="sr-only">What Family Hub does</h2>
          <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map(
              ({ accentBar, headerBg, cardBg, iconColor, Icon, title, body }, idx) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 * (idx + 1), duration: 0.4 }}
                  {...(reduceMotion
                    ? {}
                    : { whileHover: { y: -6, rotate: -1, transition: { duration: 0.15 } } })}
                >
                  <FeatureCard
                    icon={<Icon size={26} />}
                    title={title}
                    body={body}
                    headerBg={headerBg}
                    cardBg={cardBg}
                    iconColor={iconColor}
                    accentBar={accentBar}
                  />
                </motion.div>
              ),
            )}
          </div>
        </main>
      )}

      {/* FHS-544: shared site footer (same legal links + branding as the
          legal/marketing pages) so the homepage never drifts from the rest. */}
      <SiteFooter />

      {/* Public feedback widget: visible to logged-out AND logged-in visitors
          on this page. FHS-559: it renders last so the skip link, not this
          floating button, is the first thing a keyboard user reaches. */}
      <BetaFeedbackWidget variant="public" />
    </div>
  );
}

// ── Logged-in homepage ──────────────────────────────────────────────────────

interface AdultHome {
  slug: string;
  familyName: string;
  children: { id: string; displayName: string; avatarEmoji: string | null }[];
  /** FHR-32: where to finish setting up, or null when the hub is ready. */
  setupPath: string | null;
}

async function loadAdultHome(accessToken: string): Promise<AdultHome | null> {
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    // FHR-32: a stalled request must not leave the homepage loading forever.
    const signal = AbortSignal.timeout(10_000);
    const meRes = await fetch(`${API_BASE}/api/me`, { headers, signal });
    if (!meRes.ok) return null;
    const me = (await meRes.json()) as {
      tenants?: { slug: string; name: string; onboardingCompleted?: boolean }[];
    };
    // A finished family wins, so a second, half-made family never hides it.
    const t = me.tenants?.find((x) => x.onboardingCompleted !== false) ?? me.tenants?.[0];
    // FHR-32: signed in but no family yet: the create screen lives at /dashboard.
    if (!t) return { slug: '', familyName: '', children: [], setupPath: '/dashboard' };
    if (t.onboardingCompleted === false) {
      return {
        slug: t.slug,
        familyName: t.name,
        children: [],
        setupPath: `/t/${t.slug}/onboarding`,
      };
    }
    let children: AdultHome['children'] = [];
    const memRes = await fetch(`${API_BASE}/api/members`, {
      headers: { ...headers, 'x-tenant-slug': t.slug },
      signal,
    });
    if (memRes.ok) {
      const body = (await memRes.json()) as {
        members?: {
          id: string;
          displayName: string;
          avatarEmoji: string | null;
          isChild: boolean;
        }[];
      };
      children = (body.members ?? [])
        .filter((m) => m.isChild)
        .map((m) => ({ id: m.id, displayName: m.displayName, avatarEmoji: m.avatarEmoji }));
    }
    return { slug: t.slug, familyName: t.name, children, setupPath: null };
  } catch {
    return null;
  }
}

function readKidFamily(): { slug: string; name: string } | null {
  try {
    const raw = localStorage.getItem('fh.kid.lastFamily');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: string; name?: string };
    return parsed.slug ? { slug: parsed.slug, name: parsed.name ?? 'your family' } : null;
  } catch {
    return null;
  }
}

function LoggedInLanding({
  navigate,
  dashboardPath,
  familyLabel,
  slug,
  kids,
  isKid,
  reduceMotion,
  loading,
  setupPath,
}: {
  navigate: ReturnType<typeof useNavigate>;
  dashboardPath: string;
  familyLabel: string;
  slug: string | undefined;
  kids: { id: string; displayName: string; avatarEmoji: string | null }[];
  isKid: boolean;
  reduceMotion: boolean;
  loading: boolean;
  setupPath: string | null;
}) {
  // FHR-32: never claim the hub is ready before we know it is.
  if (loading || setupPath) {
    return (
      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 pt-8 text-center md:pt-4"
        data-testid={loading ? 'welcome-loggedin-loading' : 'welcome-loggedin-setup'}
      >
        <div>
          <h1 className="mb-3 font-heading text-3xl leading-tight text-yellow-300 md:text-5xl">
            Welcome back 👋
          </h1>
          {setupPath && (
            <p className="mx-auto max-w-2xl text-base font-bold text-purple-100 md:text-lg">
              Your family hub is not set up yet. Pick up where you left off.
            </p>
          )}
        </div>
        {setupPath && (
          <Button
            onClick={() => navigate(setupPath)}
            variant="primary"
            size="lg"
            className="flex items-center gap-2 px-6 py-3 text-base md:text-lg"
            testId="welcome-finish-setup"
          >
            Finish setting up
            <ArrowRight size={18} strokeWidth={3} aria-hidden="true" />
          </Button>
        )}
      </main>
    );
  }

  const quickLinks = [
    {
      title: isKid ? 'Go to my hub' : 'Go to your dashboard',
      desc: "Today's tasks, meals, and the family overview.",
      Icon: LayoutDashboard,
      headerBg: 'bg-yellow-200',
      cardBg: 'bg-yellow-50',
      accentBar: 'border-l-pink-400',
      iconColor: 'text-pink-500',
      onClick: () => navigate(dashboardPath),
    },
    // Member management + child worlds are parent-only.
    ...(isKid
      ? []
      : [
          {
            title: 'Manage family',
            desc: 'Invite a partner, add kids, set PINs and roles.',
            Icon: Users,
            headerBg: 'bg-cyan-200',
            cardBg: 'bg-cyan-50',
            accentBar: 'border-l-cyan-500',
            iconColor: 'text-blue-600',
            onClick: () => navigate(slug ? `/t/${slug}/members` : '/dashboard'),
          },
          {
            title: 'Reward settings',
            desc: 'Set what a sticker is worth and big-habit bonuses.',
            Icon: Settings,
            headerBg: 'bg-emerald-200',
            cardBg: 'bg-emerald-50',
            accentBar: 'border-l-emerald-500',
            iconColor: 'text-emerald-600',
            onClick: () => navigate(slug ? `/t/${slug}/reward-settings` : '/dashboard'),
          },
        ]),
    ...(isKid
      ? []
      : kids.slice(0, 4).map((ch) => ({
          title: `${ch.displayName}'s World`,
          desc: 'Habits, rewards, learning and more.',
          Icon: BookOpen,
          headerBg: 'bg-purple-200',
          cardBg: 'bg-purple-50',
          accentBar: 'border-l-purple-500',
          iconColor: 'text-purple-600',
          onClick: () => navigate(slug ? `/t/${slug}/child/${ch.id}` : '/dashboard'),
        }))),
  ];

  return (
    <main
      id={MAIN_CONTENT_ID}
      className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 pt-8 text-center md:pt-4"
      data-testid="welcome-loggedin"
    >
      <div>
        <h1 className="mb-3 font-heading text-3xl leading-tight text-yellow-300 md:text-5xl">
          Welcome back 👋
        </h1>
        <p className="mx-auto max-w-2xl text-base font-bold text-purple-100 md:text-lg">
          {isKid
            ? 'Your hub is ready. Jump back in.'
            : `The ${familyLabel} hub is ready. Jump back in where you left off.`}
        </p>
      </div>

      <Button
        onClick={() => navigate(dashboardPath)}
        variant="primary"
        size="lg"
        className="flex items-center gap-2 px-6 py-3 text-base md:text-lg"
      >
        {isKid ? 'Go to my hub' : 'Go to your dashboard'}
        <ArrowRight size={18} strokeWidth={3} aria-hidden="true" />
      </Button>

      {/* FHS-558: parent level for the quick-link card h3s. */}
      <h2 className="sr-only">Jump back in</h2>
      <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((q, idx) => (
          <motion.button
            key={q.title}
            type="button"
            onClick={q.onClick}
            data-testid="welcome-quicklink"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (idx + 1), duration: 0.4 }}
            {...(reduceMotion ? {} : { whileHover: { y: -4 } })}
            className="text-left"
          >
            <FeatureCard
              icon={<q.Icon size={26} />}
              title={q.title}
              body={q.desc}
              headerBg={q.headerBg}
              cardBg={q.cardBg}
              iconColor={q.iconColor}
              accentBar={q.accentBar}
            />
          </motion.button>
        ))}
      </div>
    </main>
  );
}
