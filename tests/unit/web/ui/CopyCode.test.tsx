import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyCode } from '@familyhub/ui';

// FHS-715: a short code in big letters with a Copy button, used for the
// family code on the Members page.

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('<CopyCode />', () => {
  it('shows the code in big letters, named for screen readers', () => {
    render(<CopyCode code="e29b-41d4" label="Family code" testId="cc" />);
    expect(screen.getByTestId('cc-code')).toHaveTextContent('e29b-41d4');
    expect(screen.getByLabelText('Family code: e29b-41d4')).toBeInTheDocument();
  });

  it('Copy puts the code on the clipboard and says Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyCode code="e29b-41d4" label="Family code" testId="cc" />);
    fireEvent.click(screen.getByTestId('cc-copy'));
    await waitFor(() => expect(screen.getByTestId('cc-copy')).toHaveTextContent('Copied'));
    expect(writeText).toHaveBeenCalledWith('e29b-41d4');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('goes back to Copy after two seconds', async () => {
    vi.useFakeTimers();
    setClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyCode code="e29b-41d4" label="Family code" testId="cc" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('cc-copy'));
    });
    expect(screen.getByTestId('cc-copy')).toHaveTextContent('Copied');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('cc-copy')).not.toHaveTextContent('Copied');
    expect(screen.getByTestId('cc-copy')).toHaveTextContent('Copy');
  });

  it('when copying is blocked the code stays on screen and the button keeps saying Copy', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    setClipboard(writeText);
    render(<CopyCode code="e29b-41d4" label="Family code" testId="cc" />);
    fireEvent.click(screen.getByTestId('cc-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByTestId('cc-copy')).toHaveTextContent('Copy');
    expect(screen.getByTestId('cc-copy')).not.toHaveTextContent('Copied');
    expect(screen.getByTestId('cc-code')).toHaveTextContent('e29b-41d4');
  });

  it('uses its own button words when given them', () => {
    render(<CopyCode code="e29b-41d4" label="Family code" copyLabel="Copy code" testId="cc" />);
    expect(screen.getByTestId('cc-copy')).toHaveTextContent('Copy code');
  });
});
