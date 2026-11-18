/** Resizes/crops an uploaded image client-side to a small square JPEG before it's sent to the backend. */
const SPRITE_SIZE = 160;
const JPEG_QUALITY = 0.75;

export interface CompressedSprite {
  base64: string;
  mimeType: string;
}

export function compressSpriteFile(file: File): Promise<CompressedSprite> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_SIZE;
        canvas.height = SPRITE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        // Center-crop to a square before scaling down, so the sprite isn't squished.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SPRITE_SIZE, SPRITE_SIZE);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image'));
    };
    img.src = objectUrl;
  });
}
