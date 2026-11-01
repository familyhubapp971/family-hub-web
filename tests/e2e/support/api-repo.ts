import { existsSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FHS-688: the server lives in its own repo, family-hub-api (ADR 0021). The
// browser tests boot it and read its database layout from a local copy:
// FH_API_DIR when set (CI checks it out to .ci-api), otherwise a clone next to
// this repo. Everything imports it through the tests/e2e/.api-repo link, so
// the import paths stay fixed wherever the copy lives.
const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(e2eDir, '..', '..');

export const API_DIR = path.resolve(
  process.env.FH_API_DIR ?? path.join(repoRoot, '..', 'family-hub-api'),
);
const API_LINK = path.join(e2eDir, '.api-repo');

export function linkApiRepo(): string {
  if (!existsSync(path.join(API_DIR, 'src', 'database', 'schema.ts'))) {
    throw new Error(
      `family-hub-api not found at ${API_DIR}. Clone it next to this repo, ` +
        'or set FH_API_DIR to its folder, then run pnpm install there.',
    );
  }
  try {
    if (readlinkSync(API_LINK) === API_DIR) return API_DIR;
    unlinkSync(API_LINK);
  } catch {
    // No link yet.
  }
  symlinkSync(API_DIR, API_LINK, 'dir');
  return API_DIR;
}
