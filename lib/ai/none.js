// Deterministic local fallback: rewrites by extraction + re-ordering, no AI calls.
// Image fallback: topical Unsplash hero by category.

export function rewriteNone({ title, summary, sourceName, sourceUrl }) {
  const clean = String(summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const lead = sentences.slice(0, 2).join(' ') || `Details are still emerging on this story: ${title}.`;
  const middle = sentences.slice(2, 4).join(' ');

  const deck = (sentences[0] || title).slice(0, 140);

  const html = [
    `<p>${escapeHtml(lead)}</p>`,
    middle ? `<p>${escapeHtml(middle)}</p>` : null,
    sourceUrl
      ? `<p class="source-line">Original reporting: <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(sourceName)}</a>.</p>`
      : `<p class="source-line">Source: ${escapeHtml(sourceName)}.</p>`,
  ].filter(Boolean).join('\n');

  return { html, deck };
}

const UNSPLASH_BY_CATEGORY = {
  national:   'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1600&q=80',
  california: 'https://images.unsplash.com/photo-1503891450247-ee5f8ec46dc3?w=1600&q=80',
  business:   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&q=80',
};

export function imageNone({ title, category }) {
  const url = UNSPLASH_BY_CATEGORY[category] || UNSPLASH_BY_CATEGORY.national;
  return { url, alt: title || 'News illustration' };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
