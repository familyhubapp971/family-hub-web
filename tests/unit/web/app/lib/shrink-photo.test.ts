// FHS-717: issue-report photos are shrunk on the device before sending.
// The browser's picture decoding and canvas are faked here: the test sets the
// photo's size, and decides how many bytes each saved JPEG comes out at.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CannotOpenPhotoError,
  MAX_PHOTO_BYTES,
  NotAPhotoError,
  shrinkPhoto,
} from '../../../../../src/app/lib/shrink-photo';

let photoSize = { width: 4000, height: 3000 };
let photoOpens = true;
let bytesFor: (width: number, height: number, quality: number) => number = () => 200_000;
const saves: Array<{ width: number; height: number; quality: number }> = [];
const drawOrder: string[] = [];
const ctx = {
  fillStyle: '',
  fillRect: vi.fn(() => drawOrder.push(`fill ${ctx.fillStyle}`)),
  drawImage: vi.fn(() => drawOrder.push('draw')),
};

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(_url: string) {
    queueMicrotask(() => {
      if (photoOpens) {
        this.naturalWidth = photoSize.width;
        this.naturalHeight = photoSize.height;
        this.onload?.();
      } else {
        this.onerror?.();
      }
    });
  }
}

const createObjectURL = vi.fn(() => 'blob:photo');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  photoSize = { width: 4000, height: 3000 };
  photoOpens = true;
  bytesFor = () => 200_000;
  saves.length = 0;
  drawOrder.length = 0;
  ctx.fillRect.mockClear();
  ctx.drawImage.mockClear();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('Image', FakeImage);
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    const q = quality ?? 1;
    saves.push({ width: this.width, height: this.height, quality: q });
    const size = bytesFor(this.width, this.height, q);
    callback(new Blob([new Uint8Array(size)], { type }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const photo = (type = 'image/jpeg') => new File(['x'], 'photo.jpg', { type });

describe('shrinkPhoto', () => {
  it('makes a big photo no longer than 1600px on its longest side', async () => {
    const out = await shrinkPhoto(photo());
    expect(saves[0]).toMatchObject({ width: 1600, height: 1200 });
    expect(out.type).toBe('image/jpeg');
  });

  it('keeps a tall photo the right shape', async () => {
    photoSize = { width: 3000, height: 4000 };
    await shrinkPhoto(photo());
    expect(saves[0]).toMatchObject({ width: 1200, height: 1600 });
  });

  it('leaves a small photo at its own size', async () => {
    photoSize = { width: 800, height: 600 };
    await shrinkPhoto(photo('image/png'));
    expect(saves[0]).toMatchObject({ width: 800, height: 600 });
  });

  it('saves at quality 0.8 when that is already small enough', async () => {
    await shrinkPhoto(photo());
    expect(saves.map((s) => s.quality)).toEqual([0.8]);
  });

  it('lowers the quality step by step until the photo is under 1 MB', async () => {
    const byQuality: Record<number, number> = { 0.8: 1_500_000, 0.7: 1_200_000, 0.6: 900_000 };
    bytesFor = (_w, _h, q) => byQuality[q] ?? 100;
    const out = await shrinkPhoto(photo());
    expect(saves.map((s) => s.quality)).toEqual([0.8, 0.7, 0.6]);
    expect(out.size).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
  });

  it('makes the photo smaller when even the lowest quality is too big', async () => {
    bytesFor = (w) => (w > 1000 ? 2_000_000 : 500_000);
    const out = await shrinkPhoto(photo());
    expect(saves.map((s) => s.quality)).toEqual([0.8, 0.7, 0.6, 0.5, 0.5, 0.5]);
    expect(saves.map((s) => s.width)).toEqual([1600, 1600, 1600, 1600, 1200, 900]);
    expect(out.size).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
  });

  it('paints a white background first, so see-through pictures do not turn black', async () => {
    await shrinkPhoto(photo('image/png'));
    expect(drawOrder).toEqual(['fill #ffffff', 'draw']);
  });

  it('refuses a file that is not a picture without trying to open it', async () => {
    await expect(shrinkPhoto(photo('application/pdf'))).rejects.toBeInstanceOf(NotAPhotoError);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('refuses a picture the browser cannot open, and tidies up after itself', async () => {
    photoOpens = false;
    await expect(shrinkPhoto(photo('image/heic'))).rejects.toBeInstanceOf(CannotOpenPhotoError);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('lets go of the original photo once it has been read', async () => {
    await shrinkPhoto(photo());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });
});
