/** Resizes uploaded images client-side before they're sent to the backend. */
const SPRITE_SIZE = 160;
const SPRITE_QUALITY = 0.75;
const BOARD_MAX_DIMENSION = 900;
const BOARD_QUALITY = 0.8;

export interface CompressedImage {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image'));
    };
    img.src = objectUrl;
  });
}

function canvasToCompressed(canvas: HTMLCanvasElement, quality: number): CompressedImage {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', width: canvas.width, height: canvas.height };
}

/** Center-crops to a square avatar, e.g. for the Arena. */
export async function compressSpriteFile(file: File): Promise<CompressedImage> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvasToCompressed(canvas, SPRITE_QUALITY);
}

/** Scales down (preserving aspect ratio, no cropping) for the Vision Board collage. */
export async function compressBoardImage(file: File): Promise<CompressedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, BOARD_MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, 0, width, height);
  return canvasToCompressed(canvas, BOARD_QUALITY);
}
