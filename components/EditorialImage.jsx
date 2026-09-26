import { imageUrl, IMAGE_WIDTHS } from '../lib/image-urls.js';

export default function EditorialImage({ src, alt, size = 'card', priority = false, ...props }) {
  const thumb = size === 'thumb';
  const portrait = size === 'portrait';
  const width = thumb ? 160 : portrait ? 320 : size === 'hero' ? 1280 : 640;
  const optimized = imageUrl(src, width);
  const sizes = thumb ? '80px' : portrait ? '160px' : size === 'hero'
    ? '(max-width: 768px) 100vw, 960px'
    : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px';
  return <img {...props} src={optimized} alt={alt}
    srcSet={optimized !== src ? IMAGE_WIDTHS.filter(w => w <= width).map(w => `${imageUrl(src, w)} ${w}w`).join(', ') : undefined}
    sizes={optimized !== src ? sizes : undefined}
    loading={priority ? 'eager' : 'lazy'} decoding="async"
    fetchPriority={priority ? 'high' : undefined} />;
}
