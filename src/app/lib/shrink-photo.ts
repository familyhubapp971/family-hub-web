// FHS-717: photos on an issue report are shrunk on the device before they
// are sent. A phone photo is often 3 to 8 MB; the server takes at most
// 1 MB each, and smaller uploads are quicker on a weak signal.
//
// Every photo is redrawn onto a canvas and saved as a JPEG, even a small one.
// Redrawing also drops the hidden details a phone stores in a photo,
// including where it was taken.

export const MAX_PHOTO_SIDE = 1600;
export const MAX_PHOTO_BYTES = 1_000_000;

const START_QUALITY = 0.8;
const LOWEST_QUALITY = 0.5;
const QUALITY_STEP = 0.1;
const SIZE_STEP = 0.75;
const MAX_TRIES = 12;

/** The file is not a picture at all, such as a PDF. */
export class NotAPhotoError extends Error {
  constructor() {
    super('not a photo');
    this.name = 'NotAPhotoError';
  }
}

/**
 * The file says it is a picture, but this browser cannot open it. Chrome on a
 * computer cannot open an iPhone's HEIC photos, for example; a broken file
 * lands here too.
 */
export class CannotOpenPhotoError extends Error {
  constructor() {
    super('cannot open photo');
    this.name = 'CannotOpenPhotoError';
  }
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

function loadImage(file: Blob): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) reject(new CannotOpenPhotoError());
      else resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new CannotOpenPhotoError());
    };
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new CannotOpenPhotoError())),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Returns a JPEG of the photo, no longer than 1600px on its longest side and
 * under 1,000,000 bytes. Lowers the quality first, then the size, until it fits.
 * Throws NotAPhotoError for a file that is not a picture, and
 * CannotOpenPhotoError for a picture this browser cannot open.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/')) throw new NotAPhotoError();
  const image = await loadImage(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CannotOpenPhotoError();

  let scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height));
  let quality = START_QUALITY;

  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    // JPEG has no see-through parts, so a see-through PNG would turn black
    // where it is clear. Paint the canvas white first.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= MAX_PHOTO_BYTES) return blob;

    if (quality - QUALITY_STEP >= LOWEST_QUALITY - 0.001) {
      quality = Math.round((quality - QUALITY_STEP) * 10) / 10;
    } else {
      scale *= SIZE_STEP;
    }
  }
  throw new CannotOpenPhotoError();
}
