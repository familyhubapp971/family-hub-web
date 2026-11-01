// FHS-555: the public header used to hide Features + About below md and
// squeeze the rest into one row, so a phone visitor could not reach those
// pages at all. Everything except the logo and Start free now sits behind a
// burger button. These tests lock the behaviour that fix depends on.
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteHeader, SiteFooter, MAIN_CONTENT_ID } from '../../../../src/public-pages/SiteChrome';

function renderHeader(props: Parameters<typeof SiteHeader>[0] = {}) {
  return render(
    <MemoryRouter>
      <SiteHeader {...props} />
    </MemoryRouter>,
  );
}

const burger = () => screen.getByTestId('site-nav-burger');
const panel = () => screen.queryByTestId('site-nav-panel');
const openMenu = () => fireEvent.click(burger());

describe('SiteHeader burger menu', () => {
  it('renders the burger button closed by default', () => {
    renderHeader();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeInTheDocument();
  });

  it('labels the burger for screen readers and flips the label when open', () => {
    renderHeader();
    expect(burger()).toHaveAccessibleName('Open menu');

    openMenu();
    expect(burger()).toHaveAccessibleName('Close menu');
    expect(burger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('points aria-controls at the panel it opens', () => {
    renderHeader();
    const controls = burger().getAttribute('aria-controls');

    openMenu();
    expect(panel()).toHaveAttribute('id', controls);
  });

  it('opens a panel holding every nav link plus Log in', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(open.getByRole('link', { name: label })).toBeInTheDocument();
    }
    // FHS-568: Log in carries a button's weight, not a link's.
    expect(open.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('marks the current section inside the panel', () => {
    renderHeader({ current: 'pricing' });
    openMenu();

    expect(within(panel()!).getByRole('link', { name: 'Pricing' }).className).toContain(
      'text-yellow-300',
    );
  });

  it('closes when the burger is tapped again', () => {
    renderHeader();

    openMenu();
    expect(panel()).toBeInTheDocument();

    fireEvent.click(burger());
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes when a link inside the panel is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(within(panel()!).getByRole('link', { name: 'Legal' }));
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes when the scrim behind the panel is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(screen.getByTestId('site-nav-scrim'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the burger', () => {
    renderHeader();
    openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(panel()).not.toBeInTheDocument();
    expect(burger()).toHaveFocus();
  });

  it('moves focus into the panel when it opens', () => {
    renderHeader();
    openMenu();

    expect(within(panel()!).getByTestId('site-nav-close')).toHaveFocus();
  });

  it('does not steal focus on first render', () => {
    renderHeader();
    expect(burger()).not.toHaveFocus();
  });

  it('traps Tab inside the panel: Tab off the last item wraps to the first', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    const login = open.getByRole('link', { name: 'Start free' });
    login.focus();
    fireEvent.keyDown(panel()!, { key: 'Tab' });

    expect(open.getByTestId('site-nav-close')).toHaveFocus();
  });

  it('traps Shift+Tab off the first item back to the last', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    open.getByTestId('site-nav-close').focus();
    fireEvent.keyDown(panel()!, { key: 'Tab', shiftKey: true });

    expect(open.getByRole('link', { name: 'Start free' })).toHaveFocus();
  });

  it('locks page scroll while the panel is open and restores it after', () => {
    renderHeader();

    openMenu();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  // FHS-572: both actions moved into the sheet on phones. The bar keeps
  // its inline pair from lg up, which CSS hides below that.
  it('offers Log in and Start free inside the menu', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    expect(open.getByTestId('site-nav-login')).toHaveAttribute('href', '/login');
    expect(open.getByTestId('site-nav-signup')).toHaveAttribute('href', '/signup');
  });

  it('keeps the bar pair for desktop only', () => {
    renderHeader();
    const bar = screen.getByRole('button', { name: 'Start free' }).parentElement!;
    expect(bar.className).toContain('hidden');
    expect(bar.className).toContain('lg:flex');
  });

  // FHS-561: header said "Legal", footer said "All legal", same destination.
  it('names every link to the legal index the same thing', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
        <SiteFooter />
      </MemoryRouter>,
    );

    const names = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/legal')
      .map((a) => a.textContent?.trim());

    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(1);
  });

  // FHS-568: it used to render as a fifth plain link under the divider.
  // FHS-572: MP styles it as a button but keeps it an anchor, which is the
  // right element for something that navigates. The point of FHS-568 was
  // the visual weight, and that holds.
  it("presents Log in with a button's weight, not as a plain text link", () => {
    renderHeader();
    openMenu();

    const login = within(panel()!).getByTestId('site-nav-login');
    expect(login.tagName).toBe('A');
    expect(login.className).toContain('border-2');
    expect(login.className).toContain('border-black');
    expect(login.className).toContain('shadow-neo-xs');
    expect(login.className).toContain('bg-white');
  });

  it('closes the menu when Log in is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(within(panel()!).getByTestId('site-nav-login'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('gives the burger a 44px minimum tap target', () => {
    renderHeader();
    // h-11 w-11 is Tailwind's 44px square: the repo's tap-target floor.
    expect(burger().className).toContain('h-11');
    expect(burger().className).toContain('w-11');
  });

  // FHS-572: MP's sheet uses 52px rows and a 48px action pair.
  it('keeps every panel row and action above the tap floor', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(open.getByRole('link', { name: label }).className).toContain('min-h-[52px]');
    }
    expect(open.getByTestId('site-nav-login').className).toContain('min-h-[48px]');
    expect(open.getByTestId('site-nav-signup').className).toContain('min-h-[48px]');
  });

  it('swaps Log in and Start free for caller-supplied actions', () => {
    renderHeader({ actions: <button type="button">Log out</button> });

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('leaves Log in out of the panel when actions are supplied', () => {
    renderHeader({ actions: <button type="button">Log out</button> });
    openMenu();

    const open = within(panel()!);
    expect(open.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(open.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  // FHS-559: keyboard users had to tab the whole nav on every page.
  it('puts a skip-to-content link before everything else in the header', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    const skip = screen.getByTestId('skip-to-content');

    expect(skip).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(skip).toHaveAccessibleName('Skip to content');
    // First element in the header means first in the tab order.
    expect(header.firstElementChild).toBe(skip);
  });

  it('keeps the skip link invisible until it is focused', () => {
    renderHeader();
    const skip = screen.getByTestId('skip-to-content');

    expect(skip.className).toContain('sr-only');
    expect(skip.className).toContain('focus:not-sr-only');
  });

  it('hides the burger and shows the inline row from lg up', () => {
    renderHeader();
    // Both navs live in the DOM; CSS decides which one a viewport shows.
    expect(burger().className).toContain('lg:hidden');

    const desktopNav = screen.getByRole('navigation', { name: 'Main' });
    expect(desktopNav.className).toContain('lg:flex');
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(within(desktopNav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

// FHS-567: at 375px the five legal links wrapped 4-then-1 and the floating
// feedback button sat on top of the copyright line.
describe('SiteFooter layout on phones', () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
  }

  // FHS-572: MP's phone footer is one dot-separated row, not a grid.
  it('lays the legal links out as one dot-separated row on phones', () => {
    renderFooter();
    const mobile = screen.getByTestId('site-footer-legal-mobile');
    expect(mobile.className).toContain('flex-wrap');
    expect(mobile.className).toContain('md:hidden');
    expect(mobile.textContent).toContain('·');
  });

  it('keeps the plain inline row for tablet and desktop', () => {
    renderFooter();
    const desktop = screen.getByTestId('site-footer-legal-desktop');
    expect(desktop.className).toContain('hidden');
    expect(desktop.className).toContain('md:flex');
    expect(desktop.textContent).not.toContain('·');
  });

  it('keeps every legal link at the 44px tap floor', () => {
    renderFooter();
    const links = within(screen.getByTestId('site-footer-legal-mobile')).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });

  it('reserves room under the small print so the floating button cannot cover it', () => {
    renderFooter();
    const copyright = screen.getByText(/virtual rewards are play money/i);
    // FHS-571: pb-24 is the clearance the button needs plus a margin.
    // pb-28 was 40px of dead space on every phone screen.
    expect(copyright.className).toContain('pb-24');
    expect(copyright.className).toContain('md:pb-8');
  });

  // FHS-571: the 44px hit areas were stacked flush, so a slightly low tap
  // on one row landed on the next. 8px is the documented minimum.
  it('spaces the dot-separated links apart', () => {
    renderFooter();
    expect(screen.getByTestId('site-footer-legal-mobile').className).toContain('gap-x-2');
  });

  // FHS-601: the page and the footer share one purple, so a top border drew a
  // seam across it. Space separates the footer now, not a line.
  it('FHS-601: draws no rule above the footer', () => {
    const { container } = renderFooter();
    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer!.className).not.toContain('border-t');
    // Still its own block: the top margin stays.
    expect(footer!.className).toContain('mt-12');
  });
});
