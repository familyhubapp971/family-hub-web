import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBodyScrollLock } from '@familyhub/ui';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Trophy,
  Lock,
  MapPin,
  Landmark as LandmarkIcon,
  Coins,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../../app/lib/auth-context';
import { useTenantSlug } from '../../../app/lib/tenant-context';
import { COUNTRIES, CONTINENTS, type Country } from './countries';
import { FlagImage } from './FlagImage';
import { CapitalMap } from './CapitalMap';
import { LandmarkImage } from './LandmarkImage';
import { CONTINENT_SOLID, CONTINENT_GRADIENT, CONTINENT_EMOJI, continentId } from './shared';
import { worldFlagsApi } from './worldFlagsApi';

// World Flags: Explore sub-tab.
//
// Tap a flashcard to cycle: flag image → name reveal → facts panel (capital
// map + landmark photo + currency + fun fact). Reaching the name-reveal state
// marks the flag as explored (POST /api/world-flags/explore or /api/kid/world-flags/explore).
// Progress bar and per-continent certificates are computed client-side.

// ─── Continent Certificate Overlay ──────────────────────────────────────────

const CONFETTI_ITEMS = ['🌟', '🎉', '🎊', '✨', '🏆', '🥇', '🏅', '💫', '🌍'];

function CertOverlay({
  continent,
  confetti,
  dismissBtnRef,
  onDismiss,
}: {
  continent: string;
  confetti: string[];
  dismissBtnRef: React.RefObject<HTMLButtonElement>;
  onDismiss: () => void;
}) {
  // Close on Escape key.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  return (
    // Backdrop: click outside the card to dismiss (div, not button: dialog card contains the real interactive elements).
    <div
      role="presentation"
      data-testid="world-cert-backdrop"
      className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onDismiss}
    >
      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((e, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute text-2xl motion-safe:animate-bounce sm:text-3xl"
            style={{
              left: `${10 + ((i * 10) % 80)}%`,
              top: `${5 + ((i * 8) % 30)}%`,
              animationDelay: `${i * 200}ms`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      {/* Cert card: stop propagation so clicking it doesn&apos;t dismiss */}
      <motion.div
        data-testid="world-cert-earned"
        role="dialog"
        aria-modal="true"
        aria-label={`${continent} Explorer Certificate`}
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border-2 border-black bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-neo-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shining header band */}
        <div className="border-b-2 border-black bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 px-6 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-900">
            Explorer Certificate
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
          <span
            aria-hidden="true"
            className="inline-block text-5xl motion-safe:animate-bounce sm:text-6xl"
          >
            {CONTINENT_EMOJI[continent] ?? '🌍'}
          </span>

          <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs">
            <p className="text-lg font-black text-gray-900">{continent} Explorer</p>
            <p className="text-sm font-bold text-indigo-600">All flags discovered. Amazing work!</p>
          </div>

          <p className="text-xs font-bold text-gray-400">
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          <div className="flex justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="text-xl motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                ⭐
              </span>
            ))}
          </div>

          <button
            ref={dismissBtnRef}
            type="button"
            onClick={onDismiss}
            className="rounded-xl border-2 border-black bg-gradient-to-r from-blue-400 to-indigo-500 px-8 py-3 text-sm font-black text-white shadow-neo-sm transition-all motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0.5 sm:text-base"
          >
            Amazing! 🌍
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close certificate"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-gray-600 shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type CardState = 'flag' | 'name' | 'facts';
type Status = 'loading' | 'ready' | 'error';

const ALL_CONTINENTS = ['All', ...CONTINENTS] as const;
type ContinentFilter = (typeof ALL_CONTINENTS)[number];

// Exactly one of memberId / kidToken is supplied.
type WorldFlagsExploreProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };

export function WorldFlagsExplore({ memberId, kidToken }: WorldFlagsExploreProps) {
  const slug = useTenantSlug();
  const { session } = useAuth();

  // In kid mode we use the kidToken directly; in parent mode we build headers
  // from the Supabase session + tenant slug.
  const api = useMemo(() => {
    if (kidToken) return worldFlagsApi({ kidToken });
    if (session) {
      return worldFlagsApi({
        memberId: memberId!,
        parentHeaders: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
      });
    }
    return null;
  }, [kidToken, memberId, session, slug]);

  const [status, setStatus] = useState<Status>('loading');
  const [explored, setExplored] = useState<Set<string>>(new Set());
  const [selectedContinent, setSelectedContinent] = useState<ContinentFilter>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>('flag');
  const [certEarned, setCertEarned] = useState<string | null>(null);
  const certTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevComplete = useRef<Record<string, boolean>>({});
  // Fire-once guard: track which certs have already triggered the overlay this session.
  const shownOverlay = useRef<Set<string>>(new Set());
  const dismissBtnRef = useRef<HTMLButtonElement>(null);

  const filteredCountries = useMemo<Country[]>(
    () =>
      selectedContinent === 'All'
        ? COUNTRIES
        : COUNTRIES.filter((c) => c.continent === selectedContinent),
    [selectedContinent],
  );

  const currentCountry = filteredCountries[currentIndex] ?? null;

  useEffect(() => {
    if (!api) return;
    const ac = new AbortController();
    setStatus('loading');
    fetch(api.exploreUrl(), { headers: api.headers, signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { explored: string[] };
        const codes = new Set(body.explored ?? []);
        setExplored(codes);
        setStatus('ready');
        for (const cont of CONTINENTS) {
          const total = COUNTRIES.filter((c) => c.continent === cont).length;
          const done = COUNTRIES.filter((c) => c.continent === cont && codes.has(c.code)).length;
          const complete = done >= total;
          prevComplete.current[cont] = complete;
          // Belt-and-suspenders: a continent already complete on load can never
          // re-trigger the overlay on this mount, even if the ref was cleared.
          if (complete) shownOverlay.current.add(cont);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ac.abort();
  }, [api]);

  useEffect(() => {
    setCurrentIndex(0);
    setCardState('flag');
  }, [selectedContinent]);

  // Clean up the cert badge timer on unmount.
  useEffect(
    () => () => {
      if (certTimerRef.current) clearTimeout(certTimerRef.current);
    },
    [],
  );

  const markExplored = useCallback(
    (code: string, continent: string) => {
      if (explored.has(code)) return;
      const next = new Set(explored);
      next.add(code);
      setExplored(next);
      if (api) {
        void fetch(api.explorePostUrl(), {
          method: 'POST',
          headers: { ...api.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(api.explorePostBody(code)),
        }).catch(() => {
          /* ignore: progress saved on next interaction */
        });
      }
      const continentCountries = COUNTRIES.filter((c) => c.continent === continent);
      const nowDone = continentCountries.filter((c) => next.has(c.code)).length;
      if (
        nowDone >= continentCountries.length &&
        !prevComplete.current[continent] &&
        !shownOverlay.current.has(continent)
      ) {
        prevComplete.current[continent] = true;
        shownOverlay.current.add(continent);
        if (certTimerRef.current) clearTimeout(certTimerRef.current);
        setCertEarned(continent);
        // Move focus to the dismiss button once the overlay renders.
        requestAnimationFrame(() => dismissBtnRef.current?.focus());
        certTimerRef.current = setTimeout(() => setCertEarned(null), 6000);
      }
    },
    [explored, api],
  );

  const handleCardTap = useCallback(() => {
    if (!currentCountry) return;
    if (cardState === 'flag') {
      setCardState('name');
      markExplored(currentCountry.code, currentCountry.continent);
    } else if (cardState === 'name') {
      setCardState('facts');
    }
  }, [cardState, currentCountry, markExplored]);

  const handleNext = useCallback(() => {
    if (!filteredCountries.length) return;
    setCurrentIndex((i) => (i + 1) % filteredCountries.length);
    setCardState('flag');
  }, [filteredCountries.length]);

  const continentStats = useMemo(
    () =>
      CONTINENTS.map((cont) => {
        const total = COUNTRIES.filter((c) => c.continent === cont).length;
        const done = COUNTRIES.filter((c) => c.continent === cont && explored.has(c.code)).length;
        return { cont, done, total, certified: done >= total };
      }),
    [explored],
  );

  const handleDismissOverlay = useCallback(() => {
    if (certTimerRef.current) clearTimeout(certTimerRef.current);
    setCertEarned(null);
  }, []);

  // Lock body scroll while the continent certificate overlay is shown (FHS-412).
  useBodyScrollLock(Boolean(certEarned));

  const exploredInFilter = filteredCountries.filter((c) => explored.has(c.code)).length;

  if (status === 'loading') {
    return (
      <p
        data-testid="world-flags-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading world flags…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="world-flags-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load. Try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Full-screen continent certificate overlay */}
      {certEarned && (
        <CertOverlay
          continent={certEarned}
          confetti={CONFETTI_ITEMS}
          dismissBtnRef={dismissBtnRef}
          onDismiss={handleDismissOverlay}
        />
      )}

      {/* Continent filter bar */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by continent"
      >
        {ALL_CONTINENTS.map((cont) => {
          const isActive = selectedContinent === cont;
          const colorClass = CONTINENT_SOLID[cont] ?? 'bg-gray-700';
          const id = continentId(cont);
          return (
            <button
              key={cont}
              data-testid={`world-continent-${id}`}
              type="button"
              onClick={() => setSelectedContinent(cont)}
              className={`min-h-[44px] shrink-0 rounded-xl border-2 border-black px-3 py-2 text-xs font-black whitespace-nowrap transition-transform motion-safe:hover:-translate-y-0.5 ${
                isActive ? `${colorClass} text-white shadow-neo-xs` : 'bg-white text-gray-600'
              }`}
            >
              {cont}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        data-testid="world-progress"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs"
        aria-label={`${exploredInFilter} of ${filteredCountries.length} flags explored`}
      >
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span>Flags explored</span>
          <span>
            {exploredInFilter} / {filteredCountries.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={exploredInFilter}
          aria-valuemin={0}
          aria-valuemax={filteredCountries.length}
          className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
        >
          <div
            data-testid="world-progress-fill"
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${CONTINENT_GRADIENT[selectedContinent] ?? CONTINENT_GRADIENT['All']}`}
            style={{
              width:
                filteredCountries.length > 0
                  ? `${(exploredInFilter / filteredCountries.length) * 100}%`
                  : '0%',
            }}
          />
        </div>
      </div>

      {/* Flash card */}
      {currentCountry ? (
        <div
          data-testid="world-flashcard"
          onClick={cardState !== 'facts' ? handleCardTap : undefined}
          role={cardState !== 'facts' ? 'button' : undefined}
          tabIndex={cardState !== 'facts' ? 0 : undefined}
          onKeyDown={(e) => {
            if (cardState !== 'facts' && (e.key === 'Enter' || e.key === ' ')) handleCardTap();
          }}
          aria-label={
            cardState === 'flag'
              ? `Flag of unknown country. Tap to reveal name.`
              : cardState === 'name'
                ? `${currentCountry.name}. Tap to see facts.`
                : `Facts for ${currentCountry.name}`
          }
          className={`rounded-xl border-2 border-black bg-white shadow-neo-sm transition-transform ${
            cardState !== 'facts'
              ? 'cursor-pointer motion-safe:hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-black'
              : ''
          }`}
        >
          {/* Flag section: continent gradient background (legacy parity) */}
          <div
            className={`flex flex-col items-center gap-3 border-b-2 border-black bg-gradient-to-br p-8 ${CONTINENT_GRADIENT[selectedContinent] ?? CONTINENT_GRADIENT['All']}`}
          >
            {explored.has(currentCountry.code) && cardState === 'flag' && (
              <div className="self-end rounded-full border-2 border-black bg-green-300 px-2 py-0.5 text-[10px] font-black">
                Explored
              </div>
            )}
            <FlagImage
              country={currentCountry}
              size="w320"
              className={`h-auto w-44 rounded-lg border-2 border-white/40 shadow-md sm:w-56 ${
                cardState === 'flag' ? 'motion-safe:animate-pulse' : ''
              }`}
              emojiClassName="text-8xl leading-none"
            />
            {cardState === 'flag' && (
              <p className="text-xs font-bold text-white/80">Tap to reveal!</p>
            )}
          </div>

          {/* Name reveal */}
          {(cardState === 'name' || cardState === 'facts') && (
            <div className="border-t-2 border-black px-6 py-4 text-center">
              <h3
                data-testid="world-flag-name"
                className="font-heading text-3xl font-black text-gray-900"
              >
                {currentCountry.name}
              </h3>
              <p className="mt-1 text-sm font-bold text-gray-500">{currentCountry.continent}</p>
              {cardState === 'name' && (
                <p className="mt-3 text-xs font-bold text-purple-600">Tap for fun facts!</p>
              )}
            </div>
          )}

          {/* Facts panel */}
          {cardState === 'facts' && (
            <div
              data-testid="world-flag-facts"
              className="flex flex-col gap-3 border-t-2 border-black p-5"
            >
              {/* Landmark photo + capital map */}
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <div className="flex flex-col overflow-hidden rounded-lg border-2 border-purple-200 bg-purple-50 p-1.5">
                  <div className="aspect-[4/3] overflow-hidden rounded bg-gray-900">
                    <LandmarkImage landmark={currentCountry.landmark} />
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-black leading-tight text-gray-900">
                    <LandmarkIcon
                      className="mr-1 inline-block h-3 w-3 align-text-bottom text-purple-500"
                      aria-hidden="true"
                    />
                    {currentCountry.landmark}
                  </p>
                </div>
                <div className="flex flex-col overflow-hidden rounded-lg border-2 border-blue-200 bg-blue-50 p-1.5">
                  <div className="aspect-[4/3] overflow-hidden rounded">
                    <CapitalMap country={currentCountry} />
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-black leading-tight text-gray-900">
                    <MapPin
                      className="mr-1 inline-block h-3 w-3 align-text-bottom text-blue-500"
                      aria-hidden="true"
                    />
                    {currentCountry.capital}
                  </p>
                </div>
              </div>

              {/* Currency + fun fact */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border-2 border-green-200 bg-green-50 px-3 py-2">
                  <Coins className="h-5 w-5 shrink-0 text-green-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-none text-gray-900">
                      {currentCountry.currencySymbol}
                    </p>
                    <p className="truncate text-sm font-bold text-gray-500">
                      {currentCountry.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                  <p className="text-xs font-bold leading-snug text-gray-800">
                    {currentCountry.funFact}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-xs">
          <p className="text-4xl">🌍</p>
          <p className="mt-2 font-heading text-lg font-black">No countries found</p>
          <p className="text-sm text-gray-500">Try a different continent.</p>
        </div>
      )}

      {/* Next flag button */}
      {currentCountry && (
        <button
          data-testid="world-next-flag"
          type="button"
          onClick={handleNext}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-black py-3 font-heading text-base font-black text-white shadow-neo-sm transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Next flag <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}

      {/* Continent certificates (at-a-glance summary) */}
      <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-xs">
        <h3 className="mb-4 font-heading text-lg uppercase tracking-wide">Continent Explorer</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {continentStats.map(({ cont, done, total, certified }) => (
            <div
              key={cont}
              data-testid={`world-cert-${continentId(cont)}`}
              className={`flex items-center gap-3 rounded-lg border-2 border-black p-3 ${
                certified ? 'bg-yellow-200' : 'bg-gray-50'
              }`}
            >
              {certified ? (
                <Trophy size={22} className="shrink-0 text-yellow-600" aria-label="Certified" />
              ) : (
                <Lock size={22} className="shrink-0 text-gray-400" aria-label="Not yet certified" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{cont}</p>
                <p className="text-xs text-gray-500">
                  {done}/{total} explored
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
