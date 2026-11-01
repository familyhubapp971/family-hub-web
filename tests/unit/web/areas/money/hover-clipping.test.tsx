import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// FHS-633: the money sheets' choice lists scroll. Each row lifts a couple of
// pixels on hover and carries a hard offset shadow. A scroll box with no
// padding clips both, so the row's border and shadow were sliced off for as
// long as the pointer was on it.
//
// This is asserted on the class list rather than in a browser because clipping
// is a paint effect: jsdom has no layout, so a rendered test cannot see it.
// The rule it encodes is simple and durable: if a list scrolls, it must leave
// room on every side for what its rows draw outside themselves.

const ROOT = join(__dirname, '../../../../..');

const SCROLLING_LISTS = [
  'src/areas/money/InvestFlow.tsx',
  'src/areas/money/WithdrawFlow.tsx',
  'src/areas/money/ClaimRewardFlow.tsx',
];

describe('the money sheets never clip a row on hover (FHS-633)', () => {
  it.each(SCROLLING_LISTS)('%s leaves room around its scrolling list', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const scrollers = source
      .split('\n')
      .filter((line) => line.includes('overflow-y-auto'))
      .map((line) => line.trim());

    expect(scrollers.length, `${file} should still have a scrolling list`).toBeGreaterThan(0);

    for (const line of scrollers) {
      // Room on every side for the lift (vertical) and the offset shadow
      // (horizontal), so nothing a row draws gets sliced by the scroll box.
      expect(line, `no vertical room, the hover lift will be clipped: ${line}`).toMatch(/\bpy-\d/);
      expect(line, `no horizontal room, the shadow will be clipped: ${line}`).toMatch(/\bpx-\d/);
    }
  });
});
