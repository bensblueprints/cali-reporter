// Provider-agnostic AI adapter.
// Two independent dimensions: AI_TEXT_PROVIDER, AI_IMAGE_PROVIDER.
// Always returns { html, deck } for text and { url } for image.
// On any failure, falls back to the `none` provider so the pipeline never blocks.

import { rewriteAnthropic } from './anthropic.js';
import { rewriteOpenAI, imageOpenAI } from './openai.js';
import { rewriteGrok, imageGrok } from './grok.js';
import { imageReplicate } from './replicate.js';
import { rewriteNone, imageNone } from './none.js';

const TEXT = (process.env.AI_TEXT_PROVIDER || 'none').toLowerCase();
const IMAGE = (process.env.AI_IMAGE_PROVIDER || 'none').toLowerCase();

/**
 * Rewrite a source article into our voice + return a magazine-style deck.
 * @param {{title:string, summary:string, sourceName:string, sourceUrl:string, category:string}} input
 * @returns {Promise<{html:string, deck:string}>}
 */
export async function rewriteArticle(input) {
  try {
    if (TEXT === 'grok' || TEXT === 'xai') return await rewriteGrok(input);
    if (TEXT === 'anthropic')              return await rewriteAnthropic(input);
    if (TEXT === 'openai')                 return await rewriteOpenAI(input);
    return rewriteNone(input);
  } catch (err) {
    console.warn(`[ai] text provider "${TEXT}" failed: ${err.message} — falling back to local rewrite`);
    return rewriteNone(input);
  }
}

/**
 * Generate or fetch a hero image. Returns a URL — could be remote (DALL-E, Replicate)
 * or an Unsplash topical fallback.
 * @param {{title:string, deck:string, category:string}} input
 * @returns {Promise<{url:string, alt:string}>}
 */
export async function generateHeroImage(input) {
  try {
    if (IMAGE === 'grok' || IMAGE === 'xai') return await imageGrok(input);
    if (IMAGE === 'replicate')                return await imageReplicate(input);
    if (IMAGE === 'openai')                   return await imageOpenAI(input);
    return imageNone(input);
  } catch (err) {
    console.warn(`[ai] image provider "${IMAGE}" failed: ${err.message} — falling back to Unsplash`);
    return imageNone(input);
  }
}

export const ACTIVE_TEXT_PROVIDER = TEXT;
export const ACTIVE_IMAGE_PROVIDER = IMAGE;
