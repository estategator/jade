/**
 * Client-side image precompression.
 *
 * Resizes and re-encodes images in the browser before uploading to Supabase
 * Storage, cutting upload bytes dramatically on slow connections.
 *
 * Uses OffscreenCanvas where available, falling back to a regular canvas.
 */

const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 0.82;
/** Skip recompression if the file is already under this byte threshold. */
const SKIP_THRESHOLD_BYTES = 300_000; // 300 KB

/**
 * Compress an image File down to WebP at a sensible max resolution.
 * Returns a new Blob (always image/webp) and its object URL for preview.
 *
 * If the file is already small enough AND already WebP, it is returned as-is.
 */
export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number },
): Promise<{ blob: Blob; previewUrl: string }> {
  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? WEBP_QUALITY;

  // Fast path: skip tiny files that are already WebP
  if (file.size <= SKIP_THRESHOLD_BYTES && file.type === 'image/webp') {
    return { blob: file, previewUrl: URL.createObjectURL(file) };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Compute scaled dimensions (only shrink, never enlarge)
  let targetW = width;
  let targetH = height;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    targetW = Math.round(width * ratio);
    targetH = Math.round(height * ratio);
  }

  let blob: Blob;

  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(targetW, targetH);
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Failed to get OffscreenCanvas 2d context');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    blob = await offscreen.convertToBlob({ type: 'image/webp', quality });
  } else {
    // Fallback for browsers without OffscreenCanvas
    blob = await new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get Canvas 2d context')); return; }
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
        'image/webp',
        quality,
      );
    });
  }

  bitmap.close();
  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl };
}

// ── Adaptive concurrency helper ─────────────────────────────

type NetworkEffectiveType = '2g' | '3g' | '4g' | 'slow-2g';

interface NavigatorConnection {
  effectiveType?: NetworkEffectiveType;
}

/**
 * Pick an upload concurrency limit based on device & network hints.
 *
 * Falls back to sensible defaults when the Network Information API is
 * unavailable (e.g. Firefox, Safari).
 */
export function getAdaptiveConcurrency(): number {
  const conn = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
  const effectiveType = conn?.effectiveType;

  const cores = navigator.hardwareConcurrency ?? 4;

  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return 2;
    case '3g':
      return Math.min(4, cores);
    case '4g':
    default:
      return Math.min(10, Math.max(4, cores));
  }
}

/**
 * Run async tasks with bounded concurrency.
 * Returns results in the same order as the input tasks array.
 */
export async function pooledMap<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
