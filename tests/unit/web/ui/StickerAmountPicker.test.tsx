import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickerAmountPicker } from '../../../../design-system/src';

// FHS-623: StickerAmountPicker is the whole-number stepper the five money
// action flows use to pick "how many stickers", paired with a money preview
// line. Unlike AmountPicker (minor currency units), this one is a plain
// integer count.

describe('StickerAmountPicker', () => {
  it('shows the current value and the word "stickers"', () => {
    render(<StickerAmountPicker value={5} max={10} onChange={() => {}} testId="sp" />);
    expect((screen.getByTestId('sp-input') as HTMLInputElement).value).toBe('5');
    expect(screen.getByText('stickers')).toBeInTheDocument();
  });

  it('increment adds exactly one step (default 1)', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={5} max={10} onChange={onChange} testId="sp" />);
    fireEvent.click(screen.getByTestId('sp-increment'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('decrement subtracts exactly one step', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={5} max={10} onChange={onChange} testId="sp" />);
    fireEvent.click(screen.getByTestId('sp-decrement'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('never decrements below the minimum (default 0)', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={0} max={10} onChange={onChange} testId="sp" />);
    const decBtn = screen.getByTestId('sp-decrement');
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never increments past the max: what is actually there is the ceiling', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={10} max={10} onChange={onChange} testId="sp" />);
    const incBtn = screen.getByTestId('sp-increment');
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects a custom min floor, e.g. the 10-sticker investment minimum', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={10} min={10} max={50} onChange={onChange} testId="sp" />);
    expect(screen.getByTestId('sp-decrement')).toBeDisabled();
  });

  it('typing a value above max clamps to max', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={5} max={10} onChange={onChange} testId="sp" />);
    fireEvent.change(screen.getByTestId('sp-input'), { target: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('typing a value below min clamps to min', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={5} min={2} max={10} onChange={onChange} testId="sp" />);
    fireEvent.change(screen.getByTestId('sp-input'), { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('ignores an unparseable typed value instead of calling onChange with NaN', () => {
    const onChange = vi.fn();
    render(<StickerAmountPicker value={5} max={10} onChange={onChange} testId="sp" />);
    fireEvent.change(screen.getByTestId('sp-input'), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the optional money preview line', () => {
    render(
      <StickerAmountPicker
        value={5}
        max={10}
        onChange={() => {}}
        preview="= AED 2.50"
        testId="sp"
      />,
    );
    expect(screen.getByTestId('sp-preview')).toHaveTextContent('AED 2.50');
  });

  it('the stepper buttons meet the 44px tap floor', () => {
    render(<StickerAmountPicker value={5} max={10} onChange={() => {}} testId="sp" />);
    expect(screen.getByTestId('sp-increment').className).toContain('h-11');
    expect(screen.getByTestId('sp-decrement').className).toContain('h-11');
  });
});
