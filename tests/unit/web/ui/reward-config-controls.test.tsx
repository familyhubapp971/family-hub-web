import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle, BoostButton, ChoiceRow, ResultBanner } from '../../../../design-system/src';

// FHS-512: the small reusable pieces the "Pocket money" settings screen is
// built from (grouped in one file since each is a tiny primitive).

describe('Toggle', () => {
  it('reflects the checked state via aria-checked', () => {
    render(<Toggle checked={true} onChange={() => {}} testId="tg" />);
    expect(screen.getByTestId('tg')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with the flipped value on click', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} testId="tg" />);
    fireEvent.click(screen.getByTestId('tg'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is disabled and inert when disabled=true', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled testId="tg" />);
    expect(screen.getByTestId('tg')).toBeDisabled();
    fireEvent.click(screen.getByTestId('tg'));
    expect(onChange).not.toHaveBeenCalled();
  });

  // FIX 4 (BLOCKER): the track used to be h-8 (32px), under the 44x44px
  // minimum finger-sized tap target the responsive-design rule requires.
  it('meets the 44px minimum tap target', () => {
    render(<Toggle checked={false} onChange={() => {}} testId="tg" />);
    expect(screen.getByTestId('tg').className).toContain('min-h-[44px]');
  });
});

describe('BoostButton', () => {
  it('renders the multiplier as "Nx"', () => {
    render(<BoostButton multiplier={3} selected={false} onClick={() => {}} testId="b3" />);
    expect(screen.getByTestId('b3').textContent).toBe('3x');
  });

  it('reflects selected via aria-pressed', () => {
    render(<BoostButton multiplier={5} selected onClick={() => {}} testId="b5" />);
    expect(screen.getByTestId('b5')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<BoostButton multiplier={2} selected={false} onClick={onClick} testId="b2" />);
    fireEvent.click(screen.getByTestId('b2'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ChoiceRow', () => {
  it('reflects selected via aria-checked (radio role)', () => {
    render(<ChoiceRow selected title="Nothing happens" onClick={() => {}} testId="choice-none" />);
    const row = screen.getByTestId('choice-none');
    expect(row).toHaveAttribute('role', 'radio');
    expect(row).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the title and optional description', () => {
    render(
      <ChoiceRow
        selected={false}
        title="They lose some money"
        description="A due day missed deducts from savings"
        onClick={() => {}}
        testId="choice-penalty"
      />,
    );
    expect(screen.getByText('They lose some money')).toBeInTheDocument();
    expect(screen.getByText('A due day missed deducts from savings')).toBeInTheDocument();
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<ChoiceRow selected={false} title="Option" onClick={onClick} testId="choice" />);
    fireEvent.click(screen.getByTestId('choice'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // FHS-623: a reward costing more than the child has must not be pickable.
  it('a disabled row cannot be clicked', () => {
    const onClick = vi.fn();
    render(
      <ChoiceRow selected={false} disabled title="Too pricey" onClick={onClick} testId="choice" />,
    );
    const row = screen.getByTestId('choice');
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ResultBanner', () => {
  it('renders its children', () => {
    render(<ResultBanner testId="result">This habit pays AED 1.50 each time.</ResultBanner>);
    expect(screen.getByTestId('result').textContent).toBe('This habit pays AED 1.50 each time.');
  });

  it('defaults to the positive tone', () => {
    render(<ResultBanner testId="result">ok</ResultBanner>);
    expect(screen.getByTestId('result').className).toContain('bg-lime-50');
  });

  it('applies the warning tone when requested', () => {
    render(
      <ResultBanner testId="result" tone="warning">
        loses money
      </ResultBanner>,
    );
    expect(screen.getByTestId('result').className).toContain('bg-red-50');
  });
});
