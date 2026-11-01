import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// FHS-371: ArtDrawingCanvas: renders canvas + colour swatches, swatch selection,
// Clear button, and Save triggering toDataURL + anchor download.

// jsdom provides no real 2d canvas context. Stub getContext so the component
// doesn't throw on mount, while still tracking calls (e.g. fillRect, stroke).
const ctxStub = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 5,
  lineCap: 'round',
  lineJoin: 'round',
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  scale: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxStub as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,MOCK');
  // Reset call counts
  Object.values(ctxStub).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as ReturnType<typeof vi.fn>).mockClear();
  });
});
afterEach(() => vi.restoreAllMocks());

import { ArtDrawingCanvas } from '../../../../../../src/areas/learn/art/ArtDrawingCanvas';

describe('<ArtDrawingCanvas />', () => {
  it('renders the art-canvas container', () => {
    render(<ArtDrawingCanvas />);
    expect(screen.getByTestId('art-canvas')).toBeInTheDocument();
  });

  it('renders all 7 colour swatches', () => {
    render(<ArtDrawingCanvas />);
    const colours = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];
    for (const c of colours) {
      expect(screen.getByTestId(`art-color-${c}`)).toBeInTheDocument();
    }
  });

  it('black swatch is active by default (aria-pressed=true)', () => {
    render(<ArtDrawingCanvas />);
    expect(screen.getByTestId('art-color-black')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('art-color-red')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a swatch marks it active and deactivates the previous one', () => {
    render(<ArtDrawingCanvas />);
    fireEvent.click(screen.getByTestId('art-color-blue'));
    expect(screen.getByTestId('art-color-blue')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('art-color-black')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders the Clear button', () => {
    render(<ArtDrawingCanvas />);
    expect(screen.getByTestId('art-clear')).toBeInTheDocument();
  });

  it('clicking Clear calls fillRect (repaints white background)', () => {
    render(<ArtDrawingCanvas />);
    ctxStub.fillRect.mockClear();
    fireEvent.click(screen.getByTestId('art-clear'));
    expect(ctxStub.fillRect).toHaveBeenCalled();
  });

  it('renders the Save button', () => {
    render(<ArtDrawingCanvas />);
    expect(screen.getByTestId('art-save')).toBeInTheDocument();
  });

  it('clicking Save calls toDataURL and triggers an anchor download', () => {
    render(<ArtDrawingCanvas />);
    // Spy on the temporary anchor click
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(clickSpy);
      }
      return el;
    });

    fireEvent.click(screen.getByTestId('art-save'));

    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png');
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('Clear then Save still triggers a download (empty canvas saves fine)', () => {
    render(<ArtDrawingCanvas />);
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(clickSpy);
      return el;
    });
    fireEvent.click(screen.getByTestId('art-clear'));
    fireEvent.click(screen.getByTestId('art-save'));
    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not crash when toDataURL throws (tainted-canvas guard)', () => {
    render(<ArtDrawingCanvas />);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    // Must not throw / bubble to an error boundary.
    expect(() => fireEvent.click(screen.getByTestId('art-save'))).not.toThrow();
  });

  it('the canvas element has role=img and an aria-label', () => {
    render(<ArtDrawingCanvas />);
    const canvas = screen.getByRole('img', { name: /drawing canvas/i });
    expect(canvas).toBeInTheDocument();
  });
});
