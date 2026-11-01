import { useCallback, useEffect, useRef, useState } from 'react';

// FHS-371: Art drawing activity for the kid Learn tab.
// Freehand canvas with pointer events (mouse + touch + stylus), colour swatches,
// Clear, and Save-as-PNG download.

const COLOURS = [
  { name: 'black', hex: '#000000' },
  { name: 'red', hex: '#EF4444' },
  { name: 'orange', hex: '#F97316' },
  { name: 'yellow', hex: '#EAB308' },
  { name: 'green', hex: '#22C55E' },
  { name: 'blue', hex: '#3B82F6' },
  { name: 'purple', hex: '#A855F7' },
] as const;

type ColourName = (typeof COLOURS)[number]['name'];

export function ArtDrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeColour, setActiveColour] = useState<ColourName>('black');
  const drawing = useRef(false);

  // Fill the canvas white on mount and whenever the ref resolves.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size the pixel buffer to the rendered CSS size.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = (rect.width || 320) * dpr;
    canvas.height = (rect.height || 320) * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
  }, []);

  // Keep strokeStyle in sync with the chosen colour.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const hex = COLOURS.find((c) => c.name === activeColour)?.hex ?? '#000000';
    ctx.strokeStyle = hex;
  }, [activeColour]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const stopDrawing = useCallback(() => {
    drawing.current = false;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // toDataURL throws if the canvas is ever tainted (a cross-origin image
    // drawn onto it). We only ever draw local strokes, so this can't happen
    // today: but guard so a future change can't crash the kid's screen.
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'my-art.png';
      a.click();
    } catch {
      // Saving failed: leave the drawing on screen so nothing is lost.
    }
  }, []);

  return (
    <div
      data-testid="art-canvas"
      className="flex flex-col items-center gap-4 rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
    >
      <h2 className="font-heading text-2xl uppercase tracking-wide">🎨 Art Studio</h2>

      {/* Colour swatches */}
      <div role="group" aria-label="Brush colour" className="flex flex-wrap justify-center gap-2">
        {COLOURS.map(({ name, hex }) => (
          <button
            key={name}
            type="button"
            data-testid={`art-color-${name}`}
            aria-label={`${name} brush`}
            aria-pressed={activeColour === name}
            onClick={() => setActiveColour(name)}
            style={{ backgroundColor: hex }}
            className={`h-11 w-11 rounded-lg border-2 border-black transition-transform motion-safe:hover:-translate-y-0.5 ${
              activeColour === name ? 'ring-4 ring-violet-400 ring-offset-1' : ''
            }`}
          />
        ))}
      </div>

      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Drawing canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className="w-full max-w-md aspect-square rounded-xl border-2 border-black shadow-neo-xs cursor-crosshair"
        style={{ touchAction: 'none' }}
      />

      {/* Controls */}
      <div className="flex gap-3">
        <button
          type="button"
          data-testid="art-clear"
          aria-label="Clear the canvas"
          onClick={handleClear}
          className="min-h-[44px] rounded-xl border-2 border-black bg-white px-5 py-2 font-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="art-save"
          aria-label="Save drawing as PNG"
          onClick={handleSave}
          className="min-h-[44px] rounded-xl border-2 border-black bg-violet-400 px-5 py-2 font-black text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Save 💾
        </button>
      </div>
    </div>
  );
}
