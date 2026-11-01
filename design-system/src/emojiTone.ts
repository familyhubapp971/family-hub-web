/**
 * emojiTone: utilities for applying Fitzpatrick skin-tone modifiers to
 * person emojis in the avatar palette.
 *
 * How it works: person emojis (e.g. 👩 U+1F469) are a single Unicode scalar.
 * Appending a Fitzpatrick modifier (U+1F3FB–U+1F3FF) right after the base
 * yields the toned variant (👩🏻). Non-person emojis (🐱 ⭐) don't combine
 * with modifiers and are returned unchanged.
 *
 * References: Unicode Standard §23.4 Emoji Modifiers.
 */

// Base person emojis that accept Fitzpatrick modifiers.
export const TONEABLE_BASES = new Set(['👩', '👨', '👧', '👦', '🧒', '👵', '👴']);

/**
 * The 6-slot tone palette used by the picker.
 * Index 0 = no modifier (default yellow).
 * Indexes 1-5 = Fitzpatrick light → dark.
 */
export const SKIN_TONES = [
  { modifier: '', label: 'Default', swatch: '#FFD93D' },
  { modifier: '\u{1F3FB}', label: 'Light skin tone', swatch: '#FDDBB4' },
  { modifier: '\u{1F3FC}', label: 'Medium-light skin tone', swatch: '#E8B88A' },
  { modifier: '\u{1F3FD}', label: 'Medium skin tone', swatch: '#C68642' },
  { modifier: '\u{1F3FE}', label: 'Medium-dark skin tone', swatch: '#8D5524' },
  { modifier: '\u{1F3FF}', label: 'Dark skin tone', swatch: '#4A2912' },
] as const;

export type SkinToneModifier = (typeof SKIN_TONES)[number]['modifier'];

/**
 * Returns true when the base emoji accepts a Fitzpatrick modifier.
 * Strips any existing modifier first so toned values also return true.
 */
export function isToneable(emoji: string): boolean {
  return TONEABLE_BASES.has(stripTone(emoji));
}

/**
 * Strips any Fitzpatrick modifier from an emoji string, returning the
 * bare base code point.
 */
export function stripTone(emoji: string): string {
  // Fitzpatrick modifiers occupy code points U+1F3FB–U+1F3FF (2 UTF-16
  // code units each). Remove all of them.
  return emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
}

/**
 * Applies a Fitzpatrick modifier to a person emoji.
 * - If modifier is '' (default), returns the bare base emoji.
 * - If the emoji is not toneable, returns it unchanged.
 * - If the emoji already has a different modifier, the old one is stripped first.
 */
export function applyTone(emoji: string, modifier: SkinToneModifier): string {
  const base = stripTone(emoji);
  if (!TONEABLE_BASES.has(base)) return emoji;
  return modifier ? base + modifier : base;
}
