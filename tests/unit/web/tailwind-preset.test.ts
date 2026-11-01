import { describe, it, expect } from 'vitest';
// Relative import to bypass Vitest's package-exports resolution which doesn't
// pick up the `./tailwind.preset.js` exports map cleanly. The config file is
// plain ESM JS and the test only inspects its shape.
import preset from '../../../design-system/tailwind.preset.js';

// Sanity tests for the design-system preset. These fail loudly if the
// canonical brand purple, the heading-font alias, or the kingdom scale
// gets accidentally renamed or dropped: every consuming app would
// silently lose its design language otherwise.
describe('@familyhub/ui tailwind preset', () => {
  const colors = preset.theme.extend.colors;
  const fonts = preset.theme.extend.fontFamily;

  it('exposes the kingdom palette as a 50→950 scale', () => {
    const expected = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    for (const step of expected) {
      expect(colors.kingdom).toHaveProperty(step);
    }
  });

  it('keeps kingdom.900 = #3d1065 (canonical brand purple)', () => {
    expect(colors.kingdom['900']).toBe('#3d1065');
  });

  it('keeps the kingdom.bg alias so legacy bg-kingdom-bg keeps working', () => {
    expect(colors.kingdom.bg).toBe('#3d1065');
  });

  it('exposes both font-display (legacy) and font-heading (MP) aliases pointing at Fredoka One', () => {
    expect(fonts.display[0]).toBe('"Fredoka One"');
    expect(fonts.heading[0]).toBe('"Fredoka One"');
  });

  it('exposes the space-bg starfield animation', () => {
    expect(preset.theme.extend.animation['space-bg']).toContain('space-move');
    expect(preset.theme.extend.keyframes['space-move']).toBeDefined();
  });

  it('exposes the neo-brutalist shadow scale (xs→lg)', () => {
    const shadow = preset.theme.extend.boxShadow;
    for (const step of ['neo-xs', 'neo-sm', 'neo', 'neo-md', 'neo-lg']) {
      expect(shadow).toHaveProperty(step);
    }
  });

  it('exposes the Magic Patterns pastel aliases', () => {
    expect(colors.pastel).toMatchObject({
      yellow: '#fef9c3',
      pink: '#fce7f3',
      cyan: '#cffafe',
      lime: '#ecfccb',
    });
  });
});
