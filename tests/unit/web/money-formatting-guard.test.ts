import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FHS-614: the guard the ticket asks for.
//
// FHS-613 added one money formatter; FHS-614 converted the ~39 screens that
// still glued a currency onto a number by hand. Nothing stops the 40th from
// appearing next week, and it would be invisible in review: "USD 7.50" reads
// fine to an English eye and is wrong for most of the world.
//
// So this walks the source and fails on the shapes that produce a hand-built
// money string. It is deliberately narrow: it looks for a currency token sat
// directly beside an amount, not for the words "currency" or "toFixed" on
// their own, so it does not nag about legitimate code.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = [
  path.resolve(HERE, '../../../src'),
  path.resolve(HERE, '../../../design-system/src'),
];

/**
 * Lines that are allowed to look like a money string.
 *
 * `AmountPicker` holds an editable number: the amount lives in an `<input>`
 * and only the symbol beside it is ours to draw, so it cannot render one
 * formatted string. It uses `currencySymbol()` for the prefix, which is the
 * sanctioned escape hatch.
 */
const ALLOWED = [path.join('design-system', 'src', 'AmountPicker.tsx')];

// A currency-ish expression: the bare identifier, or any `.currency` property
// off an object (`stats.currency`, `week.currency`), which the first cut of
// this guard missed entirely.
const CUR = String.raw`(?:[A-Za-z_$][\w$]*\.)?currency`;

// The other half has to actually look like an amount. Without this the guard
// fires on the World Flags lesson, which prints a country's currency symbol
// beside its currency NAME: real text, no money in sight.
const AMT = String.raw`[^{}]*(?:toFixed|[Aa]mount|[Cc]ash|[Vv]alue|[Rr]ate|[Pp]rice|Minor|[Bb]alance)[^{}]*`;

const OFFENDERS: Array<{ pattern: RegExp; why: string }> = [
  {
    // {currency} {amount}  /  {currency}{amount}
    pattern: new RegExp(String.raw`\{\s*${CUR}\s*\}\s*\{${AMT}\}`),
    why: 'a currency rendered next to an amount',
  },
  {
    // {amount} {currency}
    pattern: new RegExp(String.raw`\{${AMT}\}\s*\{\s*${CUR}\s*\}`),
    why: 'an amount rendered next to a currency',
  },
  {
    // `${currency} ${amount}` and `${amount} ${currency}` in a template string
    pattern: new RegExp(
      String.raw`\$\{\s*${CUR}\s*\}\s*\$\{${AMT}\}|\$\{${AMT}\}\s*\$\{\s*${CUR}\s*\}`,
    ),
    why: 'a currency glued to an amount in a template string',
  },
  {
    // ANY hardcoded ISO code beside an amount, in either order. The first cut
    // knew only AED/USD/GBP/EUR and only code-first, so `${x} CAD` and
    // `NGN {x}` both sailed through. CurrencyPicker offers 30 codes.
    pattern: new RegExp(String.raw`\b[A-Z]{3}\b\s+\$?\{${AMT}\}|\{${AMT}\}\s*[A-Z]{3}\b`),
    why: 'a hardcoded currency code beside an amount',
  },
  {
    // The sanctioned symbol helper, misused to hand-roll a whole money string.
    // `${currencySymbol(c)}${x.toFixed(2)}` puts the symbol in front with an
    // English decimal point, which is the original bug wearing a new hat.
    pattern: /currencySymbol\([^)]*\)\s*\}?\s*\$?\{?\s*[\w.]*(?:toFixed|amount|cash|value|rate)/i,
    why: 'currencySymbol() glued to an amount instead of formatMoney()',
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('money is always written through the shared helper (FHS-614)', () => {
  it('no screen builds a money string by hand', () => {
    const found: string[] = [];

    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        if (ALLOWED.some((allowed) => file.endsWith(allowed))) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          // Prettier wraps long JSX, and the code this ticket removed had
          // exactly that shape, so a line-by-line scan would have missed the
          // real thing. Each line is checked joined to the next as well.
          const joined = `${line} ${lines[i + 1] ?? ''}`;
          for (const { pattern, why } of OFFENDERS) {
            if (pattern.test(line) || pattern.test(joined)) {
              const rel = path.relative(path.resolve(HERE, '../../..'), file);
              found.push(`${rel}:${i + 1}  ${why}\n    ${line.trim()}`);
              break; // one report per line is enough to act on
            }
          }
        });
      }
    }

    expect(
      found,
      `Use formatMoney(amount, currency) from @familyhub/shared instead of building the ` +
        `string by hand. It puts the symbol where the viewer's locale puts it, and gets the ` +
        `decimal separator and digit grouping right.\n\n${found.join('\n')}\n`,
    ).toEqual([]);
  });

  it('catches the shapes it is meant to catch', () => {
    // Pins the guard itself: a regex that quietly stops matching is a guard
    // that quietly stops guarding.
    const samples = [
      '          {currency} {savedCash.toFixed(2)}',
      '          {cashValue} {currency}',
      '            `Invest ${currency} ${cashVal}`',
      '            `${action.cashAmount?.toFixed(2)} ${currency}`',
      '                    AED {(week.carriedOverCash ?? 0).toFixed(2)}',
      // Review findings: the shapes the first cut of this guard let through.
      '          {stats.currency} {savedCash.toFixed(2)}',
      '            `${cashVal} CAD`',
      '                    NGN {(week.carriedOverCash ?? 0).toFixed(2)}',
      '          `${currencySymbol(currency)}${amount.toFixed(2)}`',
    ];
    for (const sample of samples) {
      expect(
        OFFENDERS.some(({ pattern }) => pattern.test(sample)),
        `guard missed: ${sample.trim()}`,
      ).toBe(true);
    }
  });

  it('leaves innocent code alone', () => {
    const innocent = [
      '            currency={currency}',
      '  const currency = data?.currency ?? FALLBACK_CURRENCY;',
      '          {formatMoney(savedCash, currency)}',
      '  const displayValue = (valueMinor / 100).toFixed(2);',
      '        <CurrencyPicker value={currency} onChange={setCurrency} />',
      // The World Flags lesson prints a country's symbol beside its currency
      // NAME. Real text, no money: the guard must leave it alone.
      '                    {country.currencySymbol} {country.currency}',
    ];
    for (const line of innocent) {
      expect(
        OFFENDERS.some(({ pattern }) => pattern.test(line)),
        `guard false-positived on: ${line.trim()}`,
      ).toBe(false);
    }
  });
});
