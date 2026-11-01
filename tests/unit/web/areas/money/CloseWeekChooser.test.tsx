import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MoneyActionsSheet } from '../../../../../src/areas/money/MoneyActionsSheet';

// FHS-637: the close-week chooser, the step FHS-623 left out. Until this
// shipped, the My World board opened a completely different-looking dialog for
// the one job that sits between two redesigned screens.

const fetchMock = vi.fn();

const CHILD = { id: 'kid-1', name: 'Amina' };
const SNAPSHOT = {
  available: 87,
  saved: 12,
  invested: 20,
  currency: 'GBP',
  stickerRate: 0.5,
};
const HEADERS = { Authorization: 'Bearer tok' };
const WEEK_ID = 'week-1';

function installFetch(over: { finalize?: () => Promise<unknown> } = {}) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/finalize')) {
      if (over.finalize) return over.finalize();
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ nextWeekId: 'week-2' }),
      });
    }
    if (u.includes('/investments')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderSheet(over: Partial<React.ComponentProps<typeof MoneyActionsSheet>> = {}) {
  return render(
    <MoneyActionsSheet
      isOpen
      action="chooser"
      child={CHILD}
      snapshot={SNAPSHOT}
      weekId={WEEK_ID}
      memberId={CHILD.id}
      headers={HEADERS}
      onClose={() => {}}
      onSaved={() => {}}
      {...over}
    />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installFetch();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('close-week chooser (FHS-637)', () => {
  it('says what is on the table, in the family currency', async () => {
    renderSheet();
    const chooser = await screen.findByTestId('close-week-chooser');
    // 87 stickers at 0.50 = 43.50, written the family's way (FHS-614).
    expect(chooser.textContent).toContain('Amina has 87 stickers ready to spend');
    expect(chooser.textContent).toContain('£43.50');
    expect(chooser.textContent).not.toContain('GBP');
  });

  it('offers all five choices with a line of explanation each', async () => {
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    for (const id of ['claim', 'cash', 'save', 'invest', 'withdraw']) {
      expect(screen.getByTestId(`close-week-chooser-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('close-week-chooser-claim').textContent).toContain(
      'Swap stickers for something from the shop.',
    );
  });

  it('hides taking money out when nothing is invested', async () => {
    renderSheet({ snapshot: { ...SNAPSHOT, invested: 0 } });
    await screen.findByTestId('close-week-chooser');
    expect(screen.queryByTestId('close-week-chooser-withdraw')).not.toBeInTheDocument();
  });

  it('walks into a choice and back again', async () => {
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-cash'));
    });
    // The chooser gives way to that flow, and a back arrow appears.
    expect(screen.queryByTestId('close-week-chooser')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('money-actions-sheet-back'));
    });
    expect(await screen.findByTestId('close-week-chooser')).toBeInTheDocument();
  });

  it('closes the week and reports the new one', async () => {
    const onWeekFinalized = vi.fn();
    const onSaved = vi.fn();
    renderSheet({ onWeekFinalized, onSaved });
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    });
    await waitFor(() => expect(onWeekFinalized).toHaveBeenCalledWith('week-2'));
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByTestId('money-actions-done-message').textContent).toContain(
      'The week is closed and a new one has started for Amina.',
    );
  });

  it('carries every running investment into the new week', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/finalize'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ nextWeekId: 'w2' }) });
      if (u.includes('/investments'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ investments: [{ id: 'inv-1' }, { id: 'inv-2' }] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    });
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/finalize'));
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string).continueInvestmentIds).toEqual([
        'inv-1',
        'inv-2',
      ]);
    });
  });

  it('says so when closing the week fails, and stays open', async () => {
    installFetch({
      finalize: () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'The week could not be closed.' }),
        }),
    });
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    });
    expect(await screen.findByTestId('close-week-chooser-error')).toHaveTextContent(
      'The week could not be closed.',
    );
    // Still on the chooser, so nothing is lost and it can be retried.
    expect(screen.getByTestId('close-week-chooser')).toBeInTheDocument();
  });

  it('opened from Kids money, it is one action with no way back to a list', async () => {
    renderSheet({ action: 'cash' });
    await waitFor(() => expect(screen.getByTestId('money-actions-sheet')).toBeInTheDocument());
    expect(screen.queryByTestId('close-week-chooser')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-actions-sheet-back')).not.toBeInTheDocument();
  });
});

// The responsive sweep for this surface is a real gap, and worth naming. The
// My World Close Week button only appears on the week's LAST day, so a browser
// test opening the chooser from there passes on Sundays and fails the rest of
// the week. The QA review pointed out that the e2e seed already solves exactly
// this with date maths (support/auth/seed.ts back-dates a week on purpose), so
// this is a follow-up worth doing rather than something blocked on FHS-635:
// tracked as FHS-638. Meanwhile the tap-target floors are pinned here, and the
// sheet shell around them is the one the Kids money e2e already exercises at
// 375px and 768px.
// Review finding, found by both agents: every test above passes a static
// `isOpen` and a no-op callback, so none of them saw that the real screen
// unmounted the instant it succeeded. These mirror how MyWorldTab actually
// wires the sheet.
describe('close-week chooser: wired the way the real screen wires it (FHS-637)', () => {
  /** Mirrors MyWorldTab: the parent owns `isOpen` and closes on `onClose`. */
  function Harness({ onFinalized }: { onFinalized?: (id: string) => void }) {
    const [open, setOpen] = useState(true);
    return (
      <MoneyActionsSheet
        isOpen={open}
        action="chooser"
        child={CHILD}
        snapshot={SNAPSHOT}
        weekId={WEEK_ID}
        memberId={CHILD.id}
        headers={HEADERS}
        onClose={() => setOpen(false)}
        onSaved={() => {}}
        onWeekFinalized={(id) => onFinalized?.(id)}
      />
    );
  }

  it('shows the parent that the week closed, instead of vanishing', async () => {
    render(<Harness />);
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    });
    // The message has to survive the parent reacting to onWeekFinalized.
    expect(await screen.findByTestId('money-actions-done-message')).toHaveTextContent(
      'The week is closed and a new one has started for Amina.',
    );
    // And the parent dismisses it themselves.
    await act(async () => {
      fireEvent.click(screen.getByTestId('money-actions-done-close'));
    });
    expect(screen.queryByTestId('money-actions-sheet')).not.toBeInTheDocument();
  });

  it('a double tap only closes the week once', async () => {
    render(<Harness />);
    await screen.findByTestId('close-week-chooser');
    const finish = screen.getByTestId('close-week-chooser-finish');
    await act(async () => {
      fireEvent.click(finish);
      fireEvent.click(finish);
    });
    await waitFor(() => expect(screen.getByTestId('money-actions-done-message')).toBeVisible());
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/finalize'))).toHaveLength(1);
  });

  it('the back arrow cannot strand a finished action under a chooser header', async () => {
    render(<Harness />);
    await screen.findByTestId('close-week-chooser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    });
    await screen.findByTestId('money-actions-done-message');
    // No back arrow on the done screen: "Do something else" is the way back,
    // and it clears the finished message on the way.
    expect(screen.queryByTestId('money-actions-sheet-back')).not.toBeInTheDocument();
  });
});

// The deleted CloseWeekDialog test deliberately ran at 0.75 a sticker, so a
// regression to the old hardcoded 0.5 would fail loudly (FHS-512). Every test
// in tests/unit/web/areas/money/ happens to use 0.5, which is the very value
// that would hide such a bug, so that guard came back here.
describe('close-week chooser: the family rate, never a hardcoded one (FHS-512)', () => {
  it('values the stickers at the rate the family actually set', async () => {
    renderSheet({ snapshot: { ...SNAPSHOT, available: 20, stickerRate: 0.75 } });
    const chooser = await screen.findByTestId('close-week-chooser');
    // 20 at 0.75 = 15.00. A hardcoded 0.5 would read 10.00.
    expect(chooser.textContent).toContain('£15.00');
    expect(chooser.textContent).not.toContain('£10.00');
  });
});

describe('close-week chooser: tap targets (FHS-637)', () => {
  it('every choice and the finish button clear the 44px floor', async () => {
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    for (const id of ['claim', 'cash', 'save', 'invest', 'withdraw']) {
      expect(screen.getByTestId(`close-week-chooser-${id}`).className).toContain('min-h-[64px]');
    }
    expect(screen.getByTestId('close-week-chooser-finish').className).toContain('min-h-[52px]');
    expect(screen.getByTestId('money-actions-sheet-close').className).toContain('min-h-[44px]');
  });

  it('lifts on hover only when motion is welcome', async () => {
    renderSheet();
    await screen.findByTestId('close-week-chooser');
    expect(screen.getByTestId('close-week-chooser-claim').className).toContain('motion-safe:');
    expect(screen.getByTestId('close-week-chooser-finish').className).toContain('motion-safe:');
  });
});
