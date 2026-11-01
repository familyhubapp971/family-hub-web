// Old addresses that still get linked to, and where they now live.
// App.tsx turns each pair into a redirect.
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  // FHS-509: the draft privacy page moved under /legal.
  ['/privacy', '/legal/privacy'],
  // FHR-22: /terms was linked from sign-up but never existed.
  ['/terms', '/legal/terms'],
];
