import { describe, it, expect } from 'vitest';
import {
  familyAddressPath,
  familyNameForAddress,
  isFamilyCode,
  swapFamilyInPath,
  tidyFamilyCode,
} from '../../../../../src/app/lib/family-address';

// FHS-715: the family's private code, and its address with the name at the end.

describe('family code', () => {
  it.each(['e29b-41d4', '0000-ffff'])('%j is a family code', (code) => {
    expect(isFamilyCode(code)).toBe(true);
  });

  it.each(['smith', 'E29B-41D4', 'e29b41d4', 'e29b-41d4-x', 'g29b-41d4', ''])(
    '%j is not a family code',
    (value) => {
      expect(isFamilyCode(value)).toBe(false);
    },
  );
});

describe('family name at the end of the address', () => {
  it.each([
    ['The Smith Family', 'the-smith-family'],
    ['Müller', 'muller'],
    ["O'Brien & Co.", 'o-brien-co'],
    ['  Khan  ', 'khan'],
    ['李', ''],
  ])('%j becomes %j', (name, end) => {
    expect(familyNameForAddress(name)).toBe(end);
  });

  it('a name that matches a page name still opens the family home', () => {
    expect(familyNameForAddress('Family Settings')).toBe('family-settings-family');
    expect(familyNameForAddress('Members')).toBe('members-family');
  });

  it('the address is the code then the name', () => {
    expect(familyAddressPath('e29b-41d4', 'The Smith Family')).toBe(
      '/t/e29b-41d4/the-smith-family',
    );
  });

  it('with no usable name the address is just the code', () => {
    expect(familyAddressPath('e29b-41d4', '李')).toBe('/t/e29b-41d4');
    expect(familyAddressPath('e29b-41d4', null)).toBe('/t/e29b-41d4');
  });
});

describe('typed family code', () => {
  it.each([
    ['E29B-41D4', 'e29b-41d4'],
    ['e29b41d4', 'e29b-41d4'],
    ['e29b 41d4', 'e29b-41d4'],
    ['e29b\u201441d4', 'e29b-41d4'],
    [' e29b-41d4 ', 'e29b-41d4'],
  ])('a kid typing %j gets %j', (typed, code) => {
    expect(tidyFamilyCode(typed)).toBe(code);
  });
});

describe('same page at a new code', () => {
  it('only the family part of the address changes', () => {
    expect(swapFamilyInPath('/t/smith/child/kid-1', 'e29b-41d4')).toBe('/t/e29b-41d4/child/kid-1');
  });
});
