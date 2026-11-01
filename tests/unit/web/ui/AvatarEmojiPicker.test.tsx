import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarEmojiPicker } from '../../../../design-system/src/AvatarEmojiPicker';
import {
  applyTone,
  isToneable,
  stripTone,
  SKIN_TONES,
} from '../../../../design-system/src/emojiTone';

// FHS-433: AvatarEmojiPicker + emojiTone utility tests.
//
// Coverage:
//   - applyTone: person emoji → toned; non-person → unchanged; strip old tone first
//   - isToneable: person bases + their toned variants return true; animals/star false
//   - stripTone: removes modifier leaving bare base; idempotent on un-toned emojis
//   - picker: renders emojis + swatch row; selecting a tone re-tones person emojis
//     but leaves non-person emojis unchanged; selecting an emoji calls onSelect
//     with the toned value; value highlights the correct cell

// ── emojiTone util ────────────────────────────────────────────────────────────

describe('applyTone()', () => {
  it('applies a Fitzpatrick modifier to a person emoji', () => {
    expect(applyTone('👩', '\u{1F3FB}')).toBe('👩🏻');
    expect(applyTone('👨', '\u{1F3FF}')).toBe('👨🏿');
    expect(applyTone('🧒', '\u{1F3FD}')).toBe('🧒🏽');
  });

  it('returns the bare base when modifier is empty string (default tone)', () => {
    expect(applyTone('👩', '')).toBe('👩');
    expect(applyTone('👦', '')).toBe('👦');
  });

  it('strips an existing modifier before applying a new one', () => {
    // 👩🏻 (light) → apply dark → 👩🏿
    expect(applyTone('👩\u{1F3FB}', '\u{1F3FF}')).toBe('👩\u{1F3FF}');
  });

  it('returns non-person emojis unchanged regardless of modifier', () => {
    expect(applyTone('🐱', '\u{1F3FB}')).toBe('🐱');
    expect(applyTone('🐶', '\u{1F3FF}')).toBe('🐶');
    expect(applyTone('⭐', '\u{1F3FD}')).toBe('⭐');
  });
});

describe('isToneable()', () => {
  it('returns true for bare person emojis', () => {
    expect(isToneable('👩')).toBe(true);
    expect(isToneable('👨')).toBe(true);
    expect(isToneable('👧')).toBe(true);
    expect(isToneable('👦')).toBe(true);
    expect(isToneable('🧒')).toBe(true);
    expect(isToneable('👵')).toBe(true);
    expect(isToneable('👴')).toBe(true);
  });

  it('returns true for already-toned person emojis', () => {
    expect(isToneable('👩\u{1F3FB}')).toBe(true); // light
    expect(isToneable('👨\u{1F3FF}')).toBe(true); // dark
  });

  it('returns false for non-person emojis', () => {
    expect(isToneable('🐱')).toBe(false);
    expect(isToneable('🐶')).toBe(false);
    expect(isToneable('⭐')).toBe(false);
    expect(isToneable('🦄')).toBe(false);
  });
});

describe('stripTone()', () => {
  it('removes a Fitzpatrick modifier from a toned emoji', () => {
    expect(stripTone('👩\u{1F3FB}')).toBe('👩');
    expect(stripTone('👨\u{1F3FF}')).toBe('👨');
  });

  it('is idempotent on un-toned emojis', () => {
    expect(stripTone('👩')).toBe('👩');
    expect(stripTone('🐱')).toBe('🐱');
  });
});

// ── AvatarEmojiPicker component ───────────────────────────────────────────────

describe('<AvatarEmojiPicker />', () => {
  it('renders 6 skin-tone swatches', () => {
    render(<AvatarEmojiPicker onSelect={() => {}} testId="picker" />);
    SKIN_TONES.forEach((_t, idx) => {
      expect(screen.getByTestId(`picker-tone-${idx}`)).toBeInTheDocument();
    });
  });

  it('renders swatch aria-labels for all 6 tones', () => {
    render(<AvatarEmojiPicker onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light skin tone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark skin tone' })).toBeInTheDocument();
  });

  it('renders all 10 emojis (7 person + 3 non-person) by default', () => {
    render(<AvatarEmojiPicker onSelect={() => {}} testId="picker" />);
    // 7 person + 3 non-person = 10 emoji buttons
    for (let i = 0; i < 10; i++) {
      expect(screen.getByTestId(`picker-emoji-${i}`)).toBeInTheDocument();
    }
  });

  it('calls onSelect with the bare person emoji when Default tone is active', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker onSelect={onSelect} testId="picker" />);
    // emoji-0 is 👩 with default tone = bare 👩
    fireEvent.click(screen.getByTestId('picker-emoji-0'));
    expect(onSelect).toHaveBeenCalledWith('👩');
  });

  it('calls onSelect with the toned emoji after selecting a skin tone', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker onSelect={onSelect} testId="picker" />);
    // Select light skin tone (tone-1 = U+1F3FB)
    fireEvent.click(screen.getByTestId('picker-tone-1'));
    onSelect.mockClear();
    // Click 👩 (emoji-0): should fire with toned value
    fireEvent.click(screen.getByTestId('picker-emoji-0'));
    expect(onSelect).toHaveBeenCalledWith('👩\u{1F3FB}');
  });

  it('non-person emojis are NOT re-toned when a skin tone is selected', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker onSelect={onSelect} testId="picker" />);
    // Select dark skin tone
    fireEvent.click(screen.getByTestId('picker-tone-5'));
    onSelect.mockClear();
    // emoji-7 is 🐱 (first non-person after 7 person emojis)
    fireEvent.click(screen.getByTestId('picker-emoji-7'));
    expect(onSelect).toHaveBeenCalledWith('🐱');
  });

  it('emoji-8 is 🐶: also not toned', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker onSelect={onSelect} testId="picker" />);
    fireEvent.click(screen.getByTestId('picker-tone-3')); // medium
    onSelect.mockClear();
    fireEvent.click(screen.getByTestId('picker-emoji-8'));
    expect(onSelect).toHaveBeenCalledWith('🐶');
  });

  it('emoji-9 is ⭐: also not toned', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker onSelect={onSelect} testId="picker" />);
    fireEvent.click(screen.getByTestId('picker-tone-2')); // medium-light
    onSelect.mockClear();
    fireEvent.click(screen.getByTestId('picker-emoji-9'));
    expect(onSelect).toHaveBeenCalledWith('⭐');
  });

  it('highlights the emoji matching the value prop', () => {
    render(<AvatarEmojiPicker value="👩" onSelect={() => {}} testId="picker" />);
    const btn = screen.getByTestId('picker-emoji-0');
    // aria-pressed="true" indicates selection
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights the correct person emoji when value is toned', () => {
    // value = 👩 + U+1F3FD (medium) → base 👩 → emoji-0 should be highlighted.
    // The base comparison (stripTone on both sides) should match regardless
    // of what activeTone state is initialized to.
    const MEDIUM = '\u{1F3FD}';
    const WOMAN = '\u{1F469}';
    const tonedWoman = WOMAN + MEDIUM;
    const { getByTestId } = render(
      <AvatarEmojiPicker value={tonedWoman} onSelect={() => {}} testId="picker" />,
    );
    const btn = getByTestId('picker-emoji-0');
    // The base person emoji (👩) should be selected: aria-pressed must be 'true'.
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights a non-person emoji when value matches exactly', () => {
    render(<AvatarEmojiPicker value="🐱" onSelect={() => {}} testId="picker" />);
    expect(screen.getByTestId('picker-emoji-7').getAttribute('aria-pressed')).toBe('true');
  });

  it('when value is a toned person emoji, selects a new tone and auto-fires onSelect', () => {
    const onSelect = vi.fn();
    // Start with 👩 selected
    render(<AvatarEmojiPicker value="👩" onSelect={onSelect} testId="picker" />);
    // Select medium-dark tone (tone-4)
    fireEvent.click(screen.getByTestId('picker-tone-4'));
    // Should auto-fire with the current value toned
    expect(onSelect).toHaveBeenCalledWith('👩\u{1F3FE}');
  });

  it('when value is a non-person emoji, changing tone does NOT auto-fire onSelect', () => {
    const onSelect = vi.fn();
    render(<AvatarEmojiPicker value="🐱" onSelect={onSelect} testId="picker" />);
    fireEvent.click(screen.getByTestId('picker-tone-1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Default swatch is aria-pressed=true on initial render (no tone)', () => {
    render(<AvatarEmojiPicker onSelect={() => {}} testId="picker" />);
    expect(screen.getByTestId('picker-tone-0').getAttribute('aria-pressed')).toBe('true');
  });

  it('active swatch flips aria-pressed after selecting a tone', () => {
    render(<AvatarEmojiPicker onSelect={() => {}} testId="picker" />);
    fireEvent.click(screen.getByTestId('picker-tone-2'));
    expect(screen.getByTestId('picker-tone-0').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('picker-tone-2').getAttribute('aria-pressed')).toBe('true');
  });
});
