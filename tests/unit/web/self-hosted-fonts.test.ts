// FHS-566: the brand fonts came from Google Fonts, so every new visitor
// waited on a third-party download. With display=optional that wait usually
// lost and headings fell back to `cursive`, which macOS renders as a formal
// script face. The files now ship with the app. These tests stop any of
// that creeping back.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
const globalsCss = readFileSync(resolve(root, 'design-system/src/styles/globals.css'), 'utf8');
const preset = readFileSync(resolve(root, 'design-system/tailwind.preset.js'), 'utf8');

const FONT_FILES = [
  'fredoka-one-latin.woff2',
  'nunito-latin.woff2',
  'nunito-latin-ext.woff2',
] as const;

describe('self-hosted brand fonts', () => {
  it('ships every font file the stylesheet asks for', () => {
    for (const file of FONT_FILES) {
      expect(
        existsSync(resolve(root, 'public/fonts', file)),
        `${file} must exist in public/fonts`,
      ).toBe(true);
      expect(globalsCss).toContain(`/fonts/${file}`);
    }
  });

  it('carries the font licence alongside the files', () => {
    const licence = readFileSync(resolve(root, 'public/fonts/OFL.txt'), 'utf8');
    expect(licence).toMatch(/SIL Open Font License/i);
    expect(licence).toMatch(/Nunito/);
    expect(licence).toMatch(/Fredoka One/);
  });

  it('preloads the two faces that draw first paint', () => {
    for (const file of ['fredoka-one-latin.woff2', 'nunito-latin.woff2']) {
      expect(indexHtml).toMatch(
        new RegExp(`<link[^>]*rel="preload"[^>]*/fonts/${file.replace('.', '\\.')}`),
      );
    }
    // crossorigin is required on font preloads or the browser fetches twice.
    expect(indexHtml).toMatch(/rel="preload"[^>]*as="font"[^>]*crossorigin/);
  });

  it('never reaches out to Google for fonts', () => {
    for (const source of [indexHtml, globalsCss]) {
      expect(source).not.toContain('fonts.googleapis.com');
      expect(source).not.toContain('fonts.gstatic.com');
    }
  });

  it('keeps the content-security-policy limited to our own font origin', () => {
    expect(indexHtml).toContain("font-src 'self'");
    expect(indexHtml).not.toMatch(/font-src[^;]*gstatic/);
  });

  it('falls back to a sans-serif, never to cursive', () => {
    expect(preset).not.toMatch(/'cursive'/);
    expect(preset).toMatch(/heading: \['"Fredoka One"', 'system-ui', 'sans-serif'\]/);
    expect(preset).toMatch(/body: \['Nunito', 'system-ui', 'sans-serif'\]/);
  });
});
