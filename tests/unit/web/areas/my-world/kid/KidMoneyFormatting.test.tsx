import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KidWeeklyAccount } from '../../../../../../src/areas/my-world/kid/KidWeeklyAccount';
import { KidStats } from '../../../../../../src/areas/my-world/kid/KidStats';
import { KidMoneySkills } from '../../../../../../src/areas/my-world/kid/KidMoneySkills';
import { formatMoney } from '@familyhub/shared';

// FHS-614: the kid panels are the ones a child reads, so they are the ones
// where "GBP 3.50" does the most damage. Every amount here goes through the
// shared formatter, which means a British family reads "£3.50" and a German
// one reads "3,50 €".

const noHabits = [] as never[];

describe('kid money panels write money the family way (FHS-614)', () => {
  it('the weekly account shows the symbol, not the code', () => {
    render(
      <KidWeeklyAccount
        habits={noHabits}
        earnedThisWeek={7}
        weeklyValue={formatMoney(3.5, 'GBP', 'en-GB')}
        currency="GBP"
        stickerRate={0.5}
      />,
    );
    const panel = screen.getByTestId('kid-my-account');
    expect(panel.textContent).toContain('£3.50');
    expect(panel.textContent).not.toContain('GBP');
  });

  it("the stats panel shows the child's saved cash with a symbol", () => {
    render(
      <KidStats name="Iman" analytics={null} habits={noHabits} savedCash={12.4} currency="GBP" />,
    );
    expect(document.body.textContent).toContain('£12.40');
    expect(document.body.textContent).not.toContain('GBP');
  });

  it('money skills shows the sticker rate and savings with a symbol', () => {
    render(
      <KidMoneySkills
        stickerBalance={10}
        savedStickers={4}
        savedCash={5}
        currency="GBP"
        stickerRate={0.75}
        planted={0}
        bonus={0}
        hasInvestments={false}
      />,
    );
    expect(document.body.textContent).toContain('£0.75');
    expect(document.body.textContent).toContain('£5.00');
    expect(document.body.textContent).not.toContain('GBP');
  });

  it('a euro family reads the amount its own way', () => {
    // The case a hand-built string always got wrong: symbol after the number,
    // comma for the decimal point.
    render(
      <KidStats name="Lena" analytics={null} habits={noHabits} savedCash={12.4} currency="EUR" />,
    );
    const shown = document.body.textContent ?? '';
    expect(shown).toMatch(/12[.,]40/);
    expect(shown).toContain('€');
    expect(shown).not.toContain('EUR');
  });
});
