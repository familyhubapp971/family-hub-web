import { describe, it, expect } from 'vitest';
// Vite's ?raw import gives the file contents as a string (works under the
// vitest/Vite server, where import.meta.url is an http URL).
import indexHtml from '../../../index.html?raw';

// Regression guard for FHS-332: the World Flags feature loads images + data
// from public hosts. The Content-Security-Policy in index.html must keep
// allowing them, or flags fall back to emoji and maps/landmarks break.

const cspMatch = indexHtml.match(/Content-Security-Policy"\s*\n?\s*content="([^"]+)"/);
const csp = cspMatch?.[1] ?? '';

function directive(name: string): string {
  const m = csp.match(new RegExp(`${name} ([^;]+)`));
  return m?.[1] ?? '';
}

describe('CSP allows World Flags image + data hosts', () => {
  it('parses a CSP out of index.html', () => {
    expect(csp).toContain('img-src');
  });

  it('img-src allows the flag, map-tile, and landmark image hosts', () => {
    const imgSrc = directive('img-src');
    expect(imgSrc).toContain('https://flagcdn.com'); // real flag images
    expect(imgSrc).toContain('https://*.tile.openstreetmap.org'); // capital map tiles
    expect(imgSrc).toContain('https://upload.wikimedia.org'); // landmark photos
    expect(imgSrc).toContain('data:'); // inlined Leaflet marker icons
  });

  it('connect-src allows the Wikipedia landmark lookup', () => {
    expect(directive('connect-src')).toContain('https://en.wikipedia.org');
  });
});
