import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button, useBodyScrollLock } from '@familyhub/ui';

// SiteChrome: shared header + footer for the public marketing/legal
// pages (FHS-509), so the new /legal/* section never feels like a
// different website. Forensic port of the Magic Patterns design
// (7f19f840-c796-4eaa-90fc-934fb4ef587d, components/SiteChrome.tsx),
// adapted in three deliberate ways:
//  1. Uses the repo's own Button (@familyhub/ui) instead of MP's local
//     mock, and the `kingdom` design token instead of a literal hex.
//  2. Drops MP's `localStorage.getItem('fh_loggedIn')` logged-in check
//     (that key is never set anywhere in this codebase, it's an MP
//     demo artefact) so porting it verbatim would ship a dead code
//     path. The real marketing pages that aren't the homepage
//     (About/Pricing) don't show a logged-in state either, so this
//     matches that established, working pattern instead.
//  3. Adds "About" to the header nav (MP's version doesn't have it,
//     predating FHS-436) so the Legal section doesn't regress
//     cross-page navigation the rest of the site already has.
// The footer's tagline + copyright/reward-disclaimer line is kept
// verbatim from MP: it's legal-adjacent copy, not styling.

export type SiteChromeSection = 'features' | 'about' | 'pricing' | 'legal';

/**
 * The id every public page puts on its <main>, and the target of the skip
 * link below. Exported so pages cannot drift from the link (FHS-559).
 */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * FHS-559: keyboard and screen-reader users had to tab through the whole
 * navigation on every page before reaching content (WCAG 2.4.1). This is
 * the first focusable element on every public page. It is invisible until
 * focused, so it costs the visual design nothing.
 */
export function SkipToContent() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      data-testid="skip-to-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:flex focus:min-h-[44px] focus:items-center focus:rounded-xl focus:border-2 focus:border-black focus:bg-yellow-400 focus:px-4 focus:font-black focus:text-black focus:shadow-neo focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400"
    >
      Skip to content
    </a>
  );
}

const NAV_LINKS: {
  to: string;
  label: string;
  section: SiteChromeSection;
}[] = [
  { to: '/', label: 'Features', section: 'features' },
  { to: '/about', label: 'About', section: 'about' },
  { to: '/pricing', label: 'Pricing', section: 'pricing' },
  { to: '/legal', label: 'Legal', section: 'legal' },
];

// FHS-555: below lg the four nav links + "Log in" could not all fit next to
// the logo and the Start free button. The old fix (hiding Features + About
// under md) left phone and small-tablet visitors with no route to those
// pages at all, and the surviving links had ~24px wide tap targets. So
// everything except the logo and Start free now lives behind a burger.
export function SiteHeader({
  current,
  actions,
}: {
  current?: SiteChromeSection;
  /**
   * Replaces the logged-out "Log in" + "Start free" pair. The logged-in
   * homepage passes its profile pill + logout here (FHS-555) instead of
   * keeping a second, near-identical header that drifted out of sync.
   */
  actions?: ReactNode;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Only restore focus to the burger on a *close*, never on first paint,
  // otherwise the header steals focus from the page on every mount.
  const wasOpen = useRef(false);

  useBodyScrollLock(open);

  const close = useCallback(() => setOpen(false), []);

  // Route change closes the menu: tapping a link inside the panel navigates,
  // and the panel must not survive into the next page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // While the menu is open: Escape closes it, and Tab cycles within the
  // panel rather than escaping to the page behind the scrim. Bound at the
  // document so the panel itself stays a plain container.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('a, button');
      if (!items || items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Move focus into the panel on open, and back to the burger on close.
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    } else if (wasOpen.current) {
      burgerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const linkColor = (section: SiteChromeSection) =>
    current === section ? 'text-yellow-300' : 'text-white';

  return (
    <header className="relative z-50 mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-4 md:px-6">
      <SkipToContent />
      <Link
        to="/"
        className="relative z-50 shrink-0 rounded-lg font-heading text-xl text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 md:text-2xl"
      >
        FamilyHub
      </Link>

      {/* Desktop (lg+): the full inline row, unchanged. */}
      <nav aria-label="Main" className="hidden items-center gap-8 font-bold lg:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`rounded-lg px-2 py-2.5 transition-colors hover:text-yellow-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${linkColor(link.section)}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* z-50 keeps the bar's own controls above the open menu's scrim
          (they are siblings of it inside this header). */}
      <div className="relative z-50 flex items-center gap-2 md:gap-4">
        {/* FHS-572: on phones both actions moved inside the menu (MP's
            design), so the bar carries the logo and one control. From lg up
            the inline pair is unchanged. */}
        {actions ?? (
          <div className="hidden items-center gap-4 lg:flex">
            <Link
              to="/login"
              className="rounded-lg px-2 py-2.5 font-bold text-white transition-colors hover:text-yellow-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            >
              Log in
            </Link>
            <Button onClick={() => navigate('/signup')} variant="primary">
              Start free
            </Button>
          </div>
        )}

        {/* Phone + tablet: everything else lives behind this. */}
        <button
          ref={burgerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls={panelId}
          data-testid="site-nav-burger"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-kingdom-800 text-white shadow-neo transition-all duration-150 active:translate-y-1 active:shadow-none focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-neo-md lg:hidden"
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <>
          {/* Scrim: tapping anywhere off the panel closes it. Sits under the
              header (z-50) so the burger stays tappable to toggle back. */}
          <button
            type="button"
            onClick={close}
            // Pointer affordance only: keyboard users close with Escape or
            // the burger itself, so it stays out of the tab order.
            tabIndex={-1}
            aria-label="Close menu"
            data-testid="site-nav-scrim"
            className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
          />
          {/* FHS-572: MP's top sheet. It spans the width and sits over the
              header rather than hanging off it as a card. Modal in behaviour
              (scrim + scroll lock + focus trap), so it carries the role. */}
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            data-testid="site-nav-panel"
            className="fixed inset-x-0 top-0 z-50 border-b-2 border-black bg-kingdom-bg shadow-neo-md motion-safe:animate-menu-drop lg:hidden"
          >
            <div className="flex h-[76px] items-center justify-between px-5">
              <span className="font-heading text-xl text-white">FamilyHub</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                data-testid="site-nav-close"
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-black bg-white text-black shadow-neo-xs focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
              >
                <X className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
              </button>
            </div>

            <nav className="px-5 pb-5">
              <ul className="border-t-2 border-white/15">
                {NAV_LINKS.map((link) => (
                  <li key={link.to} className="border-b-2 border-white/15">
                    <Link
                      to={link.to}
                      onClick={close}
                      className={`flex min-h-[52px] items-center text-base font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${linkColor(link.section)}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Both actions live here on phones now: the homepage carries
                  its own Start free, so the bar does not need a second one.
                  Hidden when the caller supplies its own logged-in actions. */}
              {!actions && (
                <div className="mt-5 flex gap-3">
                  <Link
                    to="/login"
                    onClick={close}
                    data-testid="site-nav-login"
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 border-black bg-white font-heading text-sm text-black shadow-neo-xs focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={close}
                    data-testid="site-nav-signup"
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 border-black bg-yellow-300 font-heading text-sm text-black shadow-neo-xs focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400"
                  >
                    Start free
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

export const LEGAL_LINKS = [
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/children', label: 'Children & Parents' },
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal', label: 'Legal' },
];

export function SiteFooter() {
  // FHS-601: no rule above the footer. The page and the footer share one
  // purple, so a border drew a seam across it. The top margin still gives the
  // footer its own block of air.
  return (
    <footer className="relative z-10 mt-12 text-white md:mt-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:gap-10 md:px-6 md:py-10">
        <div className="md:flex-1">
          <p className="font-heading text-base md:text-xl">FamilyHub</p>
          <p className="mt-0.5 text-xs font-bold text-purple-300 md:mt-1 md:text-sm">
            One calm place for the whole family.
          </p>
        </div>

        {/* FHS-572: MP's phone footer is one tight dot-separated row rather
            than the grid FHS-567 introduced. MP sets py-1 on these, which
            is roughly 22px and half this repo's tap floor, so they keep
            44px of height while reading as a single flowing line. */}
        <nav
          aria-label="Legal"
          data-testid="site-footer-legal-mobile"
          className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-purple-200 md:hidden"
        >
          {LEGAL_LINKS.map((item, index) => (
            <Fragment key={item.to}>
              {index > 0 && (
                <span aria-hidden="true" className="text-purple-500">
                  ·
                </span>
              )}
              <Link
                to={item.to}
                className="flex min-h-[44px] items-center transition-colors active:text-yellow-300"
              >
                {item.label}
              </Link>
            </Fragment>
          ))}
        </nav>

        {/* Tablet + desktop: unchanged. */}
        <nav
          aria-label="Legal"
          data-testid="site-footer-legal-desktop"
          className="hidden flex-wrap gap-x-6 gap-y-2 md:flex md:justify-end"
        >
          {LEGAL_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[44px] items-center text-sm font-bold text-purple-200 transition-colors hover:text-yellow-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* FHS-571: pb-20 is the clearance the floating feedback button
          actually needs (24px offset + ~48px tall) plus a margin.
          pb-28 left 40px of dead space on every phone screen. */}
      <p className="mx-auto w-full max-w-7xl px-5 pb-24 text-[10px] font-bold text-purple-400 md:px-6 md:pb-8 md:text-xs">
        © {new Date().getFullYear()} [Legal entity name]. Virtual rewards are play money with no
        cash value.
      </p>
    </footer>
  );
}
