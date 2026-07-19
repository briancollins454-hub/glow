// Client-side image preparation for uploads.
//
// Phones produce 5–15MB photos, while server actions cap the request body
// size. Instead of rejecting big files with a confusing "too big" error, we
// downscale and re-encode the image in the browser so almost any photo the
// user picks uploads successfully.

/** Hard ceiling for what we will send; kept under the server action body limit. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Files at or below this size that already fit the dimensions are sent as-is. */
const RECOMPRESS_THRESHOLD_BYTES = 1024 * 1024;

const JPEG_QUALITY = 0.85;
const DEFAULT_MAX_DIMENSION = 2000;

export class ImageTooLargeError extends Error {
  constructor() {
    super("Image is too large to upload");
    this.name = "ImageTooLargeError";
  }
}

/**
 * Downscale + re-encode an image so it uploads quickly and reliably.
 * Falls back to the original file when the browser can't decode it, and
 * throws ImageTooLargeError if the result still exceeds MAX_UPLOAD_BYTES.
 */
export async function prepareImageForUpload(
  file: File,
  opts: { maxDimension?: number } = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  let prepared = file;
  try {
    const resized = await downscale(file, maxDimension);
    if (resized && resized.size < file.size) prepared = resized;
  } catch {
    // Some formats (e.g. HEIC outside Safari) can't be decoded — keep the
    // original file and rely on the size check below.
  }
  if (prepared.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
  return prepared;
}

async function downscale(file: File, maxDimension: number): Promise<File | null> {
  const source = await decode(file);
  try {
    const { width, height } = source;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (scale === 1 && file.size <= RECOMPRESS_THRESHOLD_BYTES) return null;

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // PNG keeps transparency (logos); everything else flattens to JPEG.
    const asPng = file.type === "image/png";
    if (!asPng) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(source.image, 0, 0, targetW, targetH);

    const type = asPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, asPng ? undefined : JPEG_QUALITY),
    );
    if (!blob) return null;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${asPng ? "png" : "jpg"}`, { type });
  } finally {
    source.cleanup();
  }
}

type DecodedImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
