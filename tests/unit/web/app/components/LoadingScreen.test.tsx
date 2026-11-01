import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoadingScreen } from '../../../../../src/app/components/LoadingScreen';

// FHS-419 introduced the branded loader; FHS-550 made it the ONE wait in the
// product and ported the Magic Patterns treatment. The bug it exists to kill
// is faint grey text on the dark purple, so the copy assertions matter more
// than they look.

function renderScreen(props: Parameters<typeof LoadingScreen>[0] = {}) {
  return render(
    <MemoryRouter>
      <LoadingScreen {...props} />
    </MemoryRouter>,
  );
}

describe('LoadingScreen', () => {
  it('shows the brand, a reassurance line and a progress track', () => {
    renderScreen({ context: 'callback' });
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.getByTestId('loading-progress')).toBeInTheDocument();
    // The reassurance line is itself the live region, so it gets announced.
    expect(screen.getByRole('status').textContent).toMatch(/family|hub|moment|world/i);
  });

  // The whole point of the ticket: no faint grey on the purple.
  it('renders the reassurance line in white, never grey', () => {
    renderScreen({ context: 'callback' });
    expect(screen.getByTestId('loading-copy').className).toContain('text-white');
  });

  it('gives each wait its own opening line', () => {
    const { unmount } = renderScreen({ context: 'redirect' });
    expect(screen.getByTestId('loading-copy').textContent).toMatch(/finding your family hub/i);
    unmount();

    renderScreen({ context: 'kid' });
    expect(screen.getByTestId('loading-copy').textContent).toMatch(/loading your world/i);
  });

  it('marks itself busy while waiting and not busy once it fails', () => {
    const { unmount } = renderScreen({ context: 'callback' });
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    unmount();

    renderScreen({ context: 'callback', error: { message: 'That link has expired.' } });
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the error and a way out when it fails', () => {
    renderScreen({ context: 'callback', error: { message: 'That link has expired.' } });
    expect(screen.getByRole('alert').textContent).toMatch(/expired/i);
    expect(screen.getByTestId('loading-back-to-login')).toBeInTheDocument();
    expect(screen.getByTestId('loading-copy').textContent).toMatch(/taking longer than usual/i);
  });

  it('calls onRetry from the Try again button when onRetry is provided', () => {
    const onRetry = vi.fn();
    renderScreen({ context: 'protected', error: { message: 'Something went wrong.' }, onRetry });
    fireEvent.click(screen.getByTestId('loading-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps both recovery buttons at the tap floor', () => {
    renderScreen({ context: 'callback', error: { message: 'Nope.' }, onRetry: () => undefined });
    expect(screen.getByTestId('loading-retry').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('loading-back-to-login').className).toContain('min-h-[44px]');
  });
});
