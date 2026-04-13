import sharp from 'sharp';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_IMAGE_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 80,
  format: 'webp',
};

export async function compressImage(
  buffer: Buffer,
  options: CompressionOptions = {}
): Promise<{ buffer: Buffer; size: number; originalSize: number }> {
  const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };
  const originalSize = buffer.length;

  let pipeline = sharp(buffer).resize(opts.maxWidth, opts.maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (opts.format === 'webp') {
    pipeline = pipeline.webp({ quality: opts.quality });
  } else if (opts.format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: opts.quality });
  } else {
    pipeline = pipeline.png({ quality: opts.quality });
  }

  const compressed = await pipeline.toBuffer();

  return {
    buffer: compressed,
    size: compressed.length,
    originalSize,
  };
}

export function getCompressedFileName(
  originalName: string,
  format: string = 'webp'
): string {
  const base = originalName.replace(/\.[^/.]+$/, '');
  return `${base}.${format}`;
}

export function shouldCompress(mimeType: string): boolean {
  const compressibleTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/avif',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',
  ];
  return compressibleTypes.includes(mimeType);
}

export function getCompressionEstimate(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '60-80% smaller';
  if (mimeType.startsWith('audio/')) return '30-50% smaller';
  if (mimeType.startsWith('video/')) return '20-40% smaller';
  return 'No compression available';
}
