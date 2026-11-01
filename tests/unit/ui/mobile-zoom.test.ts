// FHS-677 and FHR-20: phone screens must not zoom on tap and must fit the
// width. These are stylesheet rules, so the test reads the shared stylesheet
// and fails if a rule is removed.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The ui package's tests run in a browser-like setup, so find the stylesheet
// by path from wherever vitest was started (repo root or design-system).
const css = readFileSync(
  [
    resolve(process.cwd(), 'design-system/src/styles/globals.css'),
    resolve(process.cwd(), 'src/styles/globals.css'),
  ].find((p) => existsSync(p))!,
  'utf8',
);

describe('phone zoom rules', () => {
  it('turns off double-tap zoom but not two-finger zoom', () => {
    expect(css).toMatch(/touch-action:\s*manipulation/);
    expect(css).not.toMatch(/user-scalable\s*=\s*no/);
  });

  it('stops the page getting wider than the screen', () => {
    expect(css).toMatch(/overflow-x:\s*clip/);
  });

  it('gives small text boxes 16px on touch screens so focusing them does not zoom', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*input\.text-sm[\s\S]*font-size:\s*16px/);
  });
});
