// FHS-644: PinInput grew an alphanumeric mode for the environment passcode.
// The numeric cases are here too, because kid login (FHS-238) depends on
// letters still being refused.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from '../../../../design-system/src';

const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];

function typeInto(index: number, value: string) {
  fireEvent.change(cells()[index]!, { target: { value } });
}

describe('PinInput in alphanumeric mode', () => {
  const renderAlpha = (props: Partial<Parameters<typeof PinInput>[0]> = {}) =>
    render(<PinInput mode="alphanumeric" mask={false} autoFocus={false} {...props} />);

  it('accepts letters as well as digits', () => {
    renderAlpha();
    typeInto(0, '2');
    typeInto(1, 'F');

    expect(cells()[0]).toHaveValue('2');
    expect(cells()[1]).toHaveValue('F');
  });

  it('folds letters to upper case, so the code can be typed either way', () => {
    const onComplete = vi.fn();
    renderAlpha({ onComplete });
    for (const [index, char] of [...'2fh3'].entries()) typeInto(index, char);

    expect(onComplete).toHaveBeenCalledWith('2FH3');
  });

  it('drops anything that is neither a letter nor a digit', () => {
    renderAlpha();
    typeInto(0, '-');

    expect(cells()[0]).toHaveValue('');
  });

  it('spreads a pasted code across the cells', () => {
    const onComplete = vi.fn();
    renderAlpha({ onComplete });
    typeInto(0, '2fh3');

    expect(cells().map((cell) => cell.value)).toEqual(['2', 'F', 'H', '3']);
    expect(onComplete).toHaveBeenCalledWith('2FH3');
  });

  it('cleans a pasted code that arrived with punctuation in it', () => {
    renderAlpha();
    typeInto(0, '2-f h3');

    expect(cells().map((cell) => cell.value)).toEqual(['2', 'F', 'H', '3']);
  });

  it('says "character", not "digit", when a cell can hold a letter', () => {
    renderAlpha({ label: 'Passcode' });
    expect(screen.getByLabelText('Passcode character 1 of 4')).toBeInTheDocument();
  });

  it('turns off the corrections a keyboard would otherwise apply', () => {
    renderAlpha();
    const first = cells()[0]!;

    expect(first).toHaveAttribute('inputmode', 'text');
    expect(first).toHaveAttribute('autocapitalize', 'characters');
    expect(first).toHaveAttribute('autocomplete', 'off');
    expect(first).toHaveAttribute('spellcheck', 'false');
  });
});

describe('PinInput in its default numeric mode', () => {
  it('still refuses letters, which kid login depends on', () => {
    render(<PinInput mask={false} autoFocus={false} />);
    typeInto(0, 'F');

    expect(cells()[0]).toHaveValue('');
  });

  it('still strips non-digits out of a paste', () => {
    render(<PinInput mask={false} autoFocus={false} />);
    typeInto(0, '1a2b3c4d');

    expect(cells().map((cell) => (cell as HTMLInputElement).value)).toEqual(['1', '2', '3', '4']);
  });
});

describe('PinInput callbacks', () => {
  // The callbacks used to run inside the setValues updater, so a caller that
  // changed its own state in response was updating during render.
  it('lets a caller change its own state from onComplete without React warning', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Caller() {
      const [done, setDone] = useState(false);
      if (done) return <p>done</p>;
      return <PinInput mask={false} autoFocus={false} onComplete={() => setDone(true)} />;
    }
    render(<Caller />);
    for (const [index, char] of [...'1234'].entries()) typeInto(index, char);

    expect(screen.getByText('done')).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
