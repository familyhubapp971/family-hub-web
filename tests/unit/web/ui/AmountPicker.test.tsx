import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmountPicker } from '../../../../design-system/src';

// FHS-512: AmountPicker is the money-critical ± stepper on the "Pocket
// money" settings screen. Every assertion works in INTEGER MINOR UNITS
// (e.g. 50 = 0.50): onChange must never receive a float.

describe('AmountPicker', () => {
  it('displays the value as a decimal, formatted from minor units', () => {
    render(<AmountPicker valueMinor={150} currency="AED" onChange={() => {}} testId="ap" />);
    expect((screen.getByTestId('ap-input') as HTMLInputElement).value).toBe('1.50');
  });

  it('shows the currency SYMBOL as a prefix, not the code', () => {
    // FHS-614: the stepper's number stays editable, so this is the one money
    // control that cannot render a whole formatted string. It shows the symbol
    // beside the input instead, which is what a family expects to read.
    render(<AmountPicker valueMinor={50} currency="GBP" onChange={() => {}} testId="ap" />);
    expect(screen.getByText('£')).toBeInTheDocument();
    expect(screen.queryByText('GBP')).not.toBeInTheDocument();
  });

  it('increment adds exactly one step (default 25 minor units), never a float', () => {
    const onChange = vi.fn();
    render(<AmountPicker valueMinor={50} currency="AED" onChange={onChange} testId="ap" />);
    fireEvent.click(screen.getByTestId('ap-increment'));
    expect(onChange).toHaveBeenCalledWith(75);
    expect(Number.isInteger(onChange.mock.calls[0]![0])).toBe(true);
  });

  it('decrement subtracts exactly one step', () => {
    const onChange = vi.fn();
    render(<AmountPicker valueMinor={100} currency="AED" onChange={onChange} testId="ap" />);
    fireEvent.click(screen.getByTestId('ap-decrement'));
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('respects a custom step size', () => {
    const onChange = vi.fn();
    render(
      <AmountPicker
        valueMinor={50}
        currency="AED"
        stepMinor={10}
        onChange={onChange}
        testId="ap"
      />,
    );
    fireEvent.click(screen.getByTestId('ap-increment'));
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('never decrements below the minimum (default 0): money never goes negative', () => {
    const onChange = vi.fn();
    render(
      <AmountPicker
        valueMinor={10}
        currency="AED"
        stepMinor={25}
        onChange={onChange}
        testId="ap"
      />,
    );
    const decBtn = screen.getByTestId('ap-decrement');
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not increment past an explicit maximum', () => {
    const onChange = vi.fn();
    render(
      <AmountPicker
        valueMinor={90}
        currency="AED"
        stepMinor={25}
        maxMinor={100}
        onChange={onChange}
        testId="ap"
      />,
    );
    const incBtn = screen.getByTestId('ap-increment');
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('typing a decimal amount converts it to integer minor units (rounded, never a float)', () => {
    const onChange = vi.fn();
    render(<AmountPicker valueMinor={50} currency="AED" onChange={onChange} testId="ap" />);
    fireEvent.change(screen.getByTestId('ap-input'), { target: { value: '2.35' } });
    expect(onChange).toHaveBeenCalledWith(235);
  });

  it('typing an amount below the minimum clamps to the minimum', () => {
    const onChange = vi.fn();
    render(<AmountPicker valueMinor={50} currency="AED" onChange={onChange} testId="ap" />);
    fireEvent.change(screen.getByTestId('ap-input'), { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  // FIX 3 (BLOCKER): an oversized rate/penalty must never reach the API
  // (numeric(12,2) overflow → 500); the UI clamps it before onChange fires.
  it('typing an amount above an explicit maximum clamps to the maximum: an over-cap value is rejected', () => {
    const onChange = vi.fn();
    render(
      <AmountPicker
        valueMinor={50}
        currency="AED"
        maxMinor={100000}
        onChange={onChange}
        testId="ap"
      />,
    );
    fireEvent.change(screen.getByTestId('ap-input'), { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(100000);
  });

  it('ignores an unparseable typed value instead of calling onChange with NaN', () => {
    const onChange = vi.fn();
    render(<AmountPicker valueMinor={50} currency="AED" onChange={onChange} testId="ap" />);
    fireEvent.change(screen.getByTestId('ap-input'), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders an optional label', () => {
    render(
      <AmountPicker
        valueMinor={50}
        currency="AED"
        onChange={() => {}}
        label="Family default"
        testId="ap"
      />,
    );
    expect(screen.getByText('Family default')).toBeInTheDocument();
  });
});
