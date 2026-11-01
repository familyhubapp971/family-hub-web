/**
 * AvatarEmojiPicker: FHS-433
 *
 * A family-avatar emoji picker with skin-tone support. Shows the canonical
 * palette (person emojis + non-person emojis) plus a row of 6 skin-tone
 * swatches. Selecting a tone re-renders the person emojis with that
 * Fitzpatrick modifier; non-person emojis (🐱 🐶 ⭐) are unaffected.
 * Tapping an emoji calls onSelect with the fully-toned string baked in.
 *
 * Props:
 *   value     : currently selected emoji (toned or plain). Highlights that cell.
 *   onSelect  : called with the chosen emoji string (modifier included).
 *   testId    : optional data-testid root for the wrapper.
 *
 * Accessibility:
 *   - Tone swatches are <button> elements with explicit aria-labels.
 *   - Emoji buttons have aria-label + aria-pressed.
 *   - All tap targets are ≥ 44×44px (min-h-[44px] min-w-[44px]).
 *   - Works at 375px (single-column phone).
 */

import { useState } from 'react';
import { applyTone, isToneable, SKIN_TONES, stripTone, type SkinToneModifier } from './emojiTone';

// ── Canonical palette ─────────────────────────────────────────────────────────

/** Person emojis: accept Fitzpatrick skin-tone modifiers. */
const PERSON_EMOJIS = ['👩', '👨', '👧', '👦', '🧒', '👵', '👴'] as const;

/** Non-person emojis: rendered as-is regardless of the active tone. */
const NON_PERSON_EMOJIS = ['🐱', '🐶', '⭐'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export interface AvatarEmojiPickerProps {
  /** Currently selected emoji (toned or plain). The matching cell is highlighted. */
  value?: string;
  /** Called with the chosen toned emoji string when the user taps an emoji. */
  onSelect: (emoji: string) => void;
  /** Optional data-testid root. Swatches: `${testId}-tone-N`. Emoji buttons: `${testId}-emoji-N`. */
  testId?: string;
}

export function AvatarEmojiPicker({ value = '', onSelect, testId }: AvatarEmojiPickerProps) {
  // Derive the active tone from the currently-selected value when it is a
  // toned person emoji, so returning to the picker re-selects the right swatch.
  const [activeTone, setActiveTone] = useState<SkinToneModifier>(() => {
    if (!value) return '';
    const base = stripTone(value);
    if (base === value) return '';
    // The modifier lives after the base codepoint.
    const modifier = value.slice(base.length) as SkinToneModifier;
    return SKIN_TONES.some((t) => t.modifier === modifier) ? modifier : '';
  });

  function handleToneClick(modifier: SkinToneModifier) {
    setActiveTone(modifier);
    // If the current value is a person emoji, re-select it with the new tone
    // so the preview updates without the user having to re-tap the emoji.
    if (value && isToneable(value)) {
      onSelect(applyTone(value, modifier));
    }
  }

  // Build the displayed palette: person emojis toned, non-person unchanged.
  const displayedPersonEmojis = PERSON_EMOJIS.map((e) => applyTone(e, activeTone));

  // For highlight comparison, normalise both sides to their base.
  const valueBase = stripTone(value);

  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border-2 border-gray-200 bg-white p-3"
    >
      {/* ── Skin-tone swatch row ── */}
      <div role="group" aria-label="Skin tone" className="flex flex-wrap items-center gap-1.5">
        {SKIN_TONES.map((tone, idx) => {
          const isActive = tone.modifier === activeTone;
          return (
            <button
              key={tone.modifier || 'default'}
              type="button"
              aria-label={tone.label}
              aria-pressed={isActive}
              data-testid={testId ? `${testId}-tone-${idx}` : undefined}
              onClick={() => handleToneClick(tone.modifier)}
              style={{ backgroundColor: tone.swatch }}
              className={[
                'h-11 w-11 min-h-[44px] min-w-[44px] rounded-full border-2 transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                isActive
                  ? 'border-black shadow-[2px_2px_0_#000] scale-110'
                  : 'border-gray-300 hover:border-gray-500',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* ── Emoji grid ── */}
      <div
        role="group"
        aria-label="Choose an avatar emoji"
        className="grid grid-cols-5 gap-1 xs:grid-cols-5 sm:grid-cols-7"
      >
        {/* Person emojis (toned) */}
        {displayedPersonEmojis.map((emoji, idx) => {
          const base = stripTone(emoji);
          const isSelected = valueBase === base;
          return (
            <EmojiButton
              key={PERSON_EMOJIS[idx]}
              emoji={emoji}
              isSelected={isSelected}
              onSelect={onSelect}
              testId={testId ? `${testId}-emoji-${idx}` : undefined}
            />
          );
        })}

        {/* Non-person emojis (unchanged by tone) */}
        {NON_PERSON_EMOJIS.map((emoji, idx) => {
          const isSelected = value === emoji;
          return (
            <EmojiButton
              key={emoji}
              emoji={emoji}
              isSelected={isSelected}
              onSelect={onSelect}
              testId={testId ? `${testId}-emoji-${PERSON_EMOJIS.length + idx}` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── EmojiButton ───────────────────────────────────────────────────────────────

interface EmojiButtonProps {
  emoji: string;
  isSelected: boolean;
  onSelect: (emoji: string) => void;
  testId?: string | undefined;
}

function EmojiButton({ emoji, isSelected, onSelect, testId }: EmojiButtonProps) {
  return (
    <button
      type="button"
      aria-label={emoji}
      aria-pressed={isSelected}
      data-testid={testId}
      onClick={() => onSelect(emoji)}
      className={[
        'flex items-center justify-center rounded-lg text-2xl',
        'min-h-[44px] min-w-[44px]',
        'border-2 transition-all duration-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
        isSelected
          ? 'border-black bg-yellow-200 shadow-[2px_2px_0_#000] -translate-y-0.5'
          : 'border-transparent bg-gray-50 hover:border-gray-300 hover:bg-gray-100',
      ].join(' ')}
    >
      {emoji}
    </button>
  );
}
