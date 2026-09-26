export const IMAGE_WIDTHS = [80, 160, 320, 640, 960, 1280];

// Only our immutable, content-named uploads enter the optimizer. External
// images retain their original URL; this is deliberately not a remote proxy.
export function imageUrl(src, width = 640) {
  if (!/^\/uploads\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(src || '')) return src;
  if (!IMAGE_WIDTHS.includes(width)) throw new Error('Unsupported image width');
  return `/media/v1/${width}/${src.slice('/uploads/'.length)}.webp`;
}
