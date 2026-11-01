import { describe, it, expect } from 'vitest';

// FHS-611: the small labels on the My World money cards were a light purple on
// a purple panel. Two problems: the ones inside the Active Investments rows
// measured 3.3:1, below the 4.5:1 floor, and the rest blended by hue even where
// the numbers passed. They are now neutral light greys.
//
// This file guards the maths. The class-level guard (no faint colour class may
// reappear on those cards) lives in MyWorldTab.test.tsx.

/** Tailwind values actually used on the board. */
const HEX = {
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-900': '#581c87',
  'purple-950': '#3b0764',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'red-200': '#fecaca',
  'red-400': '#f87171',
} as const;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

/** The investment rows are `bg-white/10` over the `bg-purple-900` card. */
function over(fgHex: string, bgHex: string, alpha: number): string {
  const [fr, fg_, fb] = rgb(fgHex);
  const [br, bg_, bb] = rgb(bgHex);
  const mix = (f: number, b: number) => Math.round(b + alpha * (f - b));
  return `#${[mix(fr, br), mix(fg_, bg_), mix(fb, bb)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

const ROW_FILL = over('#ffffff', HEX['purple-900'], 0.1);
const AA = 4.5;

describe('My World money card label contrast (FHS-611)', () => {
  it('shows why the old investment-row labels failed', () => {
    // The reported defect, reproduced: slate-400 on the row's translucent fill.
    expect(contrast(HEX['slate-400'], ROW_FILL)).toBeLessThan(AA);
    expect(contrast(HEX['red-400'], ROW_FILL)).toBeLessThan(AA);
  });

  it('clears the floor with the colours now shipped on the investment rows', () => {
    expect(contrast(HEX['slate-300'], ROW_FILL)).toBeGreaterThanOrEqual(AA);
    expect(contrast(HEX['slate-200'], ROW_FILL)).toBeGreaterThanOrEqual(AA);
    expect(contrast(HEX['red-200'], ROW_FILL)).toBeGreaterThanOrEqual(AA);
  });

  it('clears the floor on the Your Savings and This Week inner panels', () => {
    for (const fg of ['slate-200', 'slate-300'] as const) {
      expect(contrast(HEX[fg], HEX['purple-950'])).toBeGreaterThanOrEqual(AA);
      expect(contrast(HEX[fg], HEX['purple-900'])).toBeGreaterThanOrEqual(AA);
    }
  });

  it('is a real formula, checked against known pairs', () => {
    // Black on white is the textbook 21:1; a colour against itself is 1:1.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast(HEX['purple-900'], HEX['purple-900'])).toBeCloseTo(1, 5);
  });
});
