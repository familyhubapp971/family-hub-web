import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MoneyActionsSheet } from '../../../../../src/areas/money/MoneyActionsSheet';
import type { ChildMoneySnapshot } from '../../../../../src/areas/money/KidsMoneyPage';

// FHS-623: each of the five money actions must send the request the ticket
// specifies, with the right body, and only close (via its "done" screen)
// once the server actually confirmed the save. Renders the sheet directly
// (not the whole Kids money page) so each assertion is about the request
// body, not the surrounding page.

const CHILD = { id: 'kid-1', name: 'Amina' };
const HEADERS = { Authorization: 'Bearer tok', 'x-tenant-slug': 'khans' };

function snapshot(overrides: Partial<ChildMoneySnapshot> = {}): ChildMoneySnapshot {
  return {
    available: 40,
    saved: 60,
    invested: 30,
    currency: 'AED',
    stickerRate: 0.5,
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

function renderSheet(
  action: 'claim' | 'cash' | 'save' | 'invest' | 'withdraw',
  opts: {
    snap?: ChildMoneySnapshot;
    onSaved?: () => void;
    onClose?: () => void;
  } = {},
) {
  const onClose = opts.onClose ?? vi.fn();
  const onSaved = opts.onSaved ?? vi.fn();
  render(
    <MoneyActionsSheet
      isOpen
      action={action}
      child={CHILD}
      snapshot={opts.snap ?? snapshot()}
      weekId="week-1"
      headers={HEADERS}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { onClose, onSaved };
}

describe('MoneyActionsSheet: Claim a reward', () => {
  it('reads the family shop, blocks a reward the child cannot afford, and redeems the affordable one', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/rewards') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            rewards: [
              { id: 'r-cheap', name: 'Ice cream', description: null, stickerCost: 10, icon: '🍦' },
              { id: 'r-dear', name: 'Bike', description: null, stickerCost: 1000, icon: null },
            ],
            stickerBalance: 40,
          }),
        });
      }
      if (u.includes('/redeem') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ stickerBalance: 30, redemptionId: 'red-1' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onSaved } = renderSheet('claim');
    await waitFor(() =>
      expect(screen.getByTestId('money-claim-reward-r-cheap')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('money-claim-reward-r-dear')).toBeDisabled();
    expect(screen.getByTestId('money-claim-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('money-claim-reward-r-cheap'));
    expect(screen.getByTestId('money-claim-confirm')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('money-claim-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [, redeemInit] = fetchMock.mock.calls.find(([url]) => String(url).includes('/redeem'))!;
    expect(
      String(fetchMock.mock.calls.find(([url]) => String(url).includes('/redeem'))![0]),
    ).toContain('/api/rewards/r-cheap/redeem');
    expect(JSON.parse((redeemInit as RequestInit).body as string)).toEqual({ memberId: 'kid-1' });

    expect(await screen.findByTestId('money-actions-done-message')).toHaveTextContent(
      'Claimed Ice cream',
    );
  });
});

describe('MoneyActionsSheet: Cash out', () => {
  it('sends the cash amount, not the sticker count, drawn from savings', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ success: true }) }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { onSaved } = renderSheet('cash', { snap: snapshot({ saved: 20, stickerRate: 0.5 }) });
    await waitFor(() => expect(screen.getByTestId('money-cash-amount')).toBeInTheDocument());

    // Defaults to the full amount in savings (20 stickers = AED 10.00).
    expect(screen.getByTestId('money-cash-amount-preview')).toHaveTextContent('AED 10.00');
    fireEvent.click(screen.getByTestId('money-cash-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/mw/financial/savings/cashout');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      memberId: 'kid-1',
      amount: 10,
    });
  });
});

describe('MoneyActionsSheet: Move to savings', () => {
  it('sends a stickers-type save drawn from what is ready to spend', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ success: true }) }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { onSaved } = renderSheet('save', { snap: snapshot({ available: 15 }) });
    await waitFor(() => expect(screen.getByTestId('money-save-amount')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('money-save-amount-decrement'));
    fireEvent.click(screen.getByTestId('money-save-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/mw/financial/savings');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      memberId: 'kid-1',
      type: 'stickers',
      amount: 14,
    });
  });

  it('zero cannot be confirmed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true }) })),
    );
    renderSheet('save', { snap: snapshot({ available: 0 }) });
    await waitFor(() => expect(screen.getByTestId('money-save-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('money-save-confirm')).not.toBeInTheDocument();
  });
});

describe('MoneyActionsSheet: Invest and grow', () => {
  it('carries the multiplier and the skipped-day rule the app has never sent before', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/habits')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ habits: [{ id: 'h-1', name: 'Read a book', icon: null }] }),
        });
      }
      if (u.includes('/api/mw/financial/investments') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'inv-new',
            investedStickers: 20,
            coefficient: 3,
            deductible: false,
          }),
        });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({ ok: true, json: async () => ({ investments: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onSaved } = renderSheet('invest', {
      snap: snapshot({ available: 40, saved: 60 }),
    });
    await waitFor(() => expect(screen.getByTestId('money-invest-habit-h-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('money-invest-habit-h-1'));
    fireEvent.click(screen.getByTestId('money-invest-coefficient-3'));
    fireEvent.click(screen.getByTestId('money-invest-deductible-off'));
    fireEvent.change(screen.getByTestId('money-invest-amount-input'), { target: { value: '20' } });

    fireEvent.click(screen.getByTestId('money-invest-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes('/api/mw/financial/investments') && init?.method === 'POST',
    )!;
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      memberId: 'kid-1',
      habitId: 'h-1',
      stickerCount: 20,
      coefficient: 3,
      deductible: false,
    });
  });

  it('will not let you invest below the 10-sticker minimum', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).includes('/api/habits'))
          return Promise.resolve({
            ok: true,
            json: async () => ({ habits: [{ id: 'h-1', name: 'Read', icon: null }] }),
          });
        return Promise.resolve({ ok: true, json: async () => ({ investments: [] }) });
      }),
    );
    renderSheet('invest', { snap: snapshot({ available: 3, saved: 2 }) });
    await waitFor(() => expect(screen.getByTestId('money-invest-not-enough')).toBeInTheDocument());
  });
});

describe('MoneyActionsSheet: Take money out of an investment', () => {
  it('withdraws a chosen partial amount, not the whole thing', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/withdraw')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, withdrawnStickers: 8, remainingStickers: 12 }),
        });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            investments: [
              {
                id: 'inv-1',
                habitId: 'h-1',
                habitName: 'Read a book',
                habitIcon: null,
                investedStickers: 20,
                currentValueStickers: 20,
                daysCompleted: 3,
                daysMissed: 0,
                deductible: true,
                coefficient: 3,
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onSaved } = renderSheet('withdraw');
    await waitFor(() =>
      expect(screen.getByTestId('money-withdraw-investment-inv-1')).toBeInTheDocument(),
    );

    // FHS-630: nothing is pre-selected and no amount is pre-filled, matching
    // the design, so the investment is chosen and then a PART of it is asked
    // for. That is the AC: a partial withdrawal, never the whole thing by
    // default.
    fireEvent.click(screen.getByTestId('money-withdraw-investment-inv-1'));
    fireEvent.change(screen.getByTestId('money-withdraw-amount-input'), { target: { value: '8' } });
    fireEvent.click(screen.getByTestId('money-withdraw-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/withdraw'))!;
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      memberId: 'kid-1',
      stickers: 8,
    });
    expect(await screen.findByTestId('money-actions-done-message')).toHaveTextContent(
      '12 stickers keep growing',
    );
  });
});

describe('MoneyActionsSheet: failure handling', () => {
  it('a failed save shows an error, stays open, and never shows the done screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'not enough weekly stickers',
            errorCode: 'INSUFFICIENT_STICKERS',
          }),
        }),
      ),
    );
    const { onSaved, onClose } = renderSheet('save', { snap: snapshot({ available: 10 }) });
    await waitFor(() => expect(screen.getByTestId('money-save-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('money-save-confirm'));

    expect(await screen.findByTestId('money-save-error')).toHaveTextContent("didn't save");
    expect(screen.queryByTestId('money-actions-done-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('money-save-confirm')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MoneyActionsSheet: chrome', () => {
  it('is a real dialog, and the close button closes it without saving', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true }) })),
    );
    const { onClose } = renderSheet('cash');
    const dialog = screen.getByTestId('money-actions-sheet');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const closeBtn = within(dialog).getByTestId('money-actions-sheet-close');
    expect(closeBtn.className).toContain('min-h-[44px]');
    expect(closeBtn.className).toContain('min-w-[44px]');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders as a bottom sheet on a phone and a centred panel from sm: up', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })),
    );
    renderSheet('cash');
    const dialog = screen.getByTestId('money-actions-sheet');
    expect(dialog.className).toContain('items-end');
    expect(dialog.className).toContain('sm:items-center');
  });
});

// FHS-630: ported from the approved Magic Patterns design. The sheets were
// built from the written spec (FHS-623) and looked different from the design
// the founder signed off: no numbered steps, different wording, and every
// step shown at once instead of appearing as each answer is given.
describe('MoneyActionsSheet: the approved design (FHS-630)', () => {
  function investApi(habits = [{ id: 'h-1', name: 'Read a book', icon: null }]) {
    return vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/habits')) {
        return Promise.resolve({ ok: true, json: async () => ({ habits }) });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({ ok: true, json: async () => ({ investments: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('asks for the habit first, and nothing else until one is picked', async () => {
    vi.stubGlobal('fetch', investApi());
    renderSheet('invest', { snap: snapshot({ available: 40, saved: 60 }) });
    await waitFor(() => expect(screen.getByTestId('money-invest-habit-h-1')).toBeInTheDocument());

    // Step 1 is numbered and phrased as a question.
    expect(screen.getByTestId('money-invest-step-1')).toHaveTextContent('Which habit?');
    expect(screen.getByTestId('money-invest-step-1')).toHaveTextContent('1');

    // The rest of the sheet is not there yet, and says why.
    expect(screen.queryByTestId('money-invest-step-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-invest-step-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-invest-step-4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-invest-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('money-invest-pick-first')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('money-invest-habit-h-1'));

    // Now every remaining question is there, worded as the design words them.
    expect(screen.getByTestId('money-invest-step-2')).toHaveTextContent('How much does it pay?');
    expect(screen.getByTestId('money-invest-step-3')).toHaveTextContent(
      'What happens on a skipped day?',
    );
    expect(screen.getByTestId('money-invest-step-4')).toHaveTextContent('How many stickers?');
    expect(screen.getByTestId('money-invest-confirm')).toBeInTheDocument();
    expect(screen.queryByTestId('money-invest-pick-first')).not.toBeInTheDocument();
  });

  it('offers the one-tap "use all" shortcut once a habit is picked', async () => {
    vi.stubGlobal('fetch', investApi());
    renderSheet('invest', { snap: snapshot({ available: 40, saved: 60 }) });
    await waitFor(() => expect(screen.getByTestId('money-invest-habit-h-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('money-invest-habit-h-1'));

    const useAll = screen.getByTestId('money-invest-amount-use-all');
    expect(useAll).toHaveTextContent('Use all 100');
    fireEvent.click(useAll);
    expect((screen.getByTestId('money-invest-amount-input') as HTMLInputElement).value).toBe('100');
  });

  it('asks which investment first, and how much only after that', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).includes('/api/mw/financial/investments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              investments: [
                {
                  id: 'inv-1',
                  habitId: 'h-1',
                  habitName: 'Read a book',
                  habitIcon: null,
                  investedStickers: 30,
                  currentValueStickers: 30,
                  daysCompleted: 2,
                  daysMissed: 0,
                  deductible: true,
                  coefficient: 3,
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );
    renderSheet('withdraw', { snap: snapshot({ investedStickers: 30 }) });
    await waitFor(() =>
      expect(screen.getByTestId('money-withdraw-investment-inv-1')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('money-withdraw-step-1')).toHaveTextContent('Which investment?');
    expect(screen.queryByTestId('money-withdraw-step-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-withdraw-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('money-withdraw-pick-first')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('money-withdraw-investment-inv-1'));

    expect(screen.getByTestId('money-withdraw-step-2')).toHaveTextContent(
      'How many stickers are you taking out?',
    );
    expect(screen.getByTestId('money-withdraw-confirm')).toBeInTheDocument();
  });
});

// FHS-631: the habit rows printed the word "heart" because the API stores an
// icon NAME and the row rendered it straight. This is the sheet-level guard;
// tests/unit/web/ui/habitIcon.test.tsx guards the helper itself.
describe('MoneyActionsSheet: a habit icon is never raw text (FHS-631)', () => {
  function investApiWithIcons(habits: Array<{ id: string; name: string; icon: string | null }>) {
    return vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/habits')) {
        return Promise.resolve({ ok: true, json: async () => ({ habits }) });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({ ok: true, json: async () => ({ investments: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('shows an icon, not the stored name, on every habit row', async () => {
    vi.stubGlobal(
      'fetch',
      investApiWithIcons([
        { id: 'h-1', name: 'I was polite', icon: 'heart' },
        { id: 'h-2', name: 'I was tidy', icon: 'trophy' },
      ]),
    );
    renderSheet('invest', { snap: snapshot({ available: 40, saved: 60 }) });
    const row = await screen.findByTestId('money-invest-habit-h-1');

    // The row reads as the habit's name and nothing else.
    expect(row.textContent).toBe('I was polite');
    expect(row.querySelector('svg')).toBeInTheDocument();
    // And the words never appear anywhere in the sheet.
    expect(screen.queryByText(/heart/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trophy/i)).not.toBeInTheDocument();
  });

  it('still draws an icon when the habit has no icon set', async () => {
    vi.stubGlobal('fetch', investApiWithIcons([{ id: 'h-1', name: 'I was polite', icon: null }]));
    renderSheet('invest', { snap: snapshot({ available: 40, saved: 60 }) });
    const row = await screen.findByTestId('money-invest-habit-h-1');
    expect(row.querySelector('svg')).toBeInTheDocument();
    expect(row.textContent).toBe('I was polite');
  });
});

// FHS-642: closing the week never showed the "all done" screen. Two separate
// faults met: the board behind reloaded loudly and unmounted the sheet
// (fixed in MyWorldTab, covered by the browser test), and the done screen
// itself was missing the design's heading and its two ways onward.
describe('MoneyActionsSheet: the done screen after closing the week (FHS-642)', () => {
  function finalizeApi() {
    return vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/finalize') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ nextWeekId: 'week-2' }) });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({ ok: true, json: async () => ({ investments: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  function renderChooser(opts: { onSeeMoney?: () => void } = {}) {
    const onClose = vi.fn();
    const onWeekFinalized = vi.fn();
    render(
      <MoneyActionsSheet
        isOpen
        action="chooser"
        child={CHILD}
        snapshot={snapshot({ available: 87 })}
        weekId="week-1"
        memberId={CHILD.id}
        headers={HEADERS}
        onClose={onClose}
        onSaved={vi.fn()}
        onWeekFinalized={onWeekFinalized}
        onSeeMoney={opts.onSeeMoney}
      />,
    );
    return { onClose, onWeekFinalized };
  }

  it('says "All done" and stays there, instead of dropping back to the choices', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    const { onWeekFinalized } = renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));

    await waitFor(() => expect(screen.getByTestId('money-actions-done-message')).toBeVisible());
    expect(screen.getByRole('status')).toHaveTextContent('All done');
    expect(screen.getByTestId('money-actions-done-message')).toHaveTextContent(
      'The week is closed and a new one has started for Amina.',
    );
    // The list of choices is gone: coming back to it is what the bug was.
    expect(screen.queryByTestId('close-week-chooser')).not.toBeInTheDocument();
    expect(onWeekFinalized).toHaveBeenCalledWith('week-2');
  });

  it('offers "Do something else", which goes back to the choices only when asked', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByTestId('money-actions-done-more')).toBeVisible());

    fireEvent.click(screen.getByTestId('money-actions-done-more'));
    expect(screen.getByTestId('close-week-chooser')).toBeInTheDocument();
  });

  it('does not offer to close the brand new week one tap after closing the last one', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByTestId('money-actions-done-more')).toBeVisible());
    fireEvent.click(screen.getByTestId('money-actions-done-more'));

    // The five choices still apply to the new week; finishing it does not.
    expect(screen.getByTestId('close-week-chooser-claim')).toBeInTheDocument();
    expect(screen.queryByTestId('close-week-chooser-finish')).not.toBeInTheDocument();
    expect(screen.getByTestId('close-week-chooser-closed')).toHaveTextContent(
      'The week is closed.',
    );
  });

  it('moves focus onto the result, so the keyboard does not fall out of the sheet', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByTestId('money-actions-done-panel')).toBeVisible());
    expect(document.activeElement).toBe(screen.getByTestId('money-actions-done-panel'));
  });

  it('announces the whole result, not just the words "All done"', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByRole('status')).toBeVisible());
    // The sentence carrying the outcome is INSIDE the live region, or a screen
    // reader announces two words and nothing about what happened.
    expect(screen.getByRole('status')).toHaveTextContent(
      'The week is closed and a new one has started for Amina.',
    );
    // "All done" is still a heading, not only a live-region label.
    expect(screen.getByRole('heading', { name: 'All done' })).toBeInTheDocument();
  });

  it('offers "See their money" when the caller has somewhere to send them', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    const onSeeMoney = vi.fn();
    const { onClose } = renderChooser({ onSeeMoney });

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByTestId('money-actions-done-see-money')).toBeVisible());

    fireEvent.click(screen.getByTestId('money-actions-done-see-money'));
    expect(onSeeMoney).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves "See their money" off where the caller gave nowhere to go', async () => {
    vi.stubGlobal('fetch', finalizeApi());
    renderChooser();

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() => expect(screen.getByTestId('money-actions-done-close')).toBeVisible());
    expect(screen.queryByTestId('money-actions-done-see-money')).not.toBeInTheDocument();
  });
});
