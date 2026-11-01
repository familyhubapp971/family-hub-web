import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dialog } from '../../../../design-system/src';

// FHS-623: the accessible dialog shell every money-action sheet (and every
// other Dialog/ConfirmDialog consumer) is built on. Covers the a11y floor
// the ticket asks for: role=dialog, focus trapped inside, focus returned
// to whatever opened it, Escape closes it.

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="opener" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <Dialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          onClose();
        }}
        ariaLabel="Test dialog"
        testId="test-dialog"
      >
        <div>
          <button type="button" data-testid="first-field">
            First
          </button>
          <button type="button" data-testid="last-field">
            Last
          </button>
        </div>
      </Dialog>
    </div>
  );
}

describe('Dialog a11y', () => {
  it('is a role=dialog with aria-modal when open', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('opener'));
    const dialog = screen.getByTestId('test-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders nothing when closed', () => {
    render(<Harness />);
    expect(screen.queryByTestId('test-dialog')).toBeNull();
  });

  it('moves focus into the dialog on open', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('opener'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('first-field')));
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByTestId('opener'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('opener'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('first-field')));
    screen.getByTestId('last-field').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first-field'));
  });

  it('Shift+Tab from the first focusable element cycles to the last', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('opener'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('first-field')));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last-field'));
  });

  it('returns focus to the element that opened it once closed', async () => {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    // fireEvent.click doesn't dispatch the mousedown that a real click uses
    // to focus its target first; focus it explicitly so the dialog captures
    // the same "who opened this" element a real click would.
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('first-field')));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('bottom-sheet alignment sticks to the bottom edge on a phone, centres from sm: up', () => {
    render(
      <Dialog isOpen onClose={() => {}} align="bottom-sheet" ariaLabel="Sheet" testId="sheet">
        <div>content</div>
      </Dialog>,
    );
    expect(screen.getByTestId('sheet').className).toContain('items-end');
    expect(screen.getByTestId('sheet').className).toContain('sm:items-center');
  });

  // FHS-678: a tall dialog was centred past the top of a phone screen.
  it('never lets its content grow taller than the screen', () => {
    render(
      <Dialog isOpen onClose={() => {}} ariaLabel="Tall" testId="tall">
        <div>content</div>
      </Dialog>,
    );
    expect(screen.getByTestId('tall-content')).toHaveClass('max-h-full', 'flex-col', 'max-w-full');
    expect(screen.getByTestId('tall')).toHaveClass('overflow-y-auto');
  });

  it('caps the bottom sheet at the screen height too', () => {
    render(
      <Dialog isOpen onClose={() => {}} align="bottom-sheet" ariaLabel="Sheet" testId="sheet">
        <div>content</div>
      </Dialog>,
    );
    expect(screen.getByTestId('sheet-content')).toHaveClass('max-h-full', 'w-full', 'sm:w-auto');
    expect(screen.getByTestId('sheet')).toHaveClass('overflow-y-auto');
  });
});
