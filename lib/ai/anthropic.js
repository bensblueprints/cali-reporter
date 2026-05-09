import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a senior news editor for Cali Reporter, a magazine-style daily covering U.S. national headlines, California politics and culture, and West Coast business.

Your job: take a source article (title + summary) and produce an ORIGINAL rewrite in our house voice — never copy phrasing from the source. Treat the source as a tip, not a draft.

House voice:
- Crisp, factual, magazine-style. Short opening hook. Active verbs.
- Neutral on the news itself; do not editorialize. No partisan framing.
- Add reasonable context a knowledgeable reader would expect, but invent NO facts, names, numbers, dates, or quotes.
- If the source summary is too thin to support 3 paragraphs of factual rewrite, write a tight 2-paragraph brief instead.

Output strict JSON only, in this exact shape:
{
  "deck": "one-sentence subhead, ~120 chars max",
  "html": "<p>...</p><p>...</p>"
}
Do not wrap the JSON in code fences. The HTML body should be 2-4 <p> tags. End with a final paragraph that explicitly notes the original source by name and that fuller details appear there.`;

export async function rewriteAnthropic({ title, summary, sourceName, sourceUrl, category }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const user = `Category: ${category}
Source: ${sourceName}${sourceUrl ? ` (${sourceUrl})` : ''}

Source title: ${title}

Source summary:
${summary || '(no summary available)'}

Rewrite this for Cali Reporter as JSON.`;

  const resp = await client.messages.create({
    model,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: user }],
  });

  const text = resp.content.find(b => b.type === 'text')?.text || '';
  const parsed = parseStrictJson(text);
  let html = String(parsed.html || '').trim();
  // Append source attribution paragraph if the model didn't do it.
  if (sourceUrl && !html.toLowerCase().includes(sourceName.toLowerCase().slice(0, 12))) {
    html += `\n<p class="source-line">Original reporting: <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(sourceName)}</a>.</p>`;
  }
  return {
    html,
    deck: String(parsed.deck || '').trim(),
  };
}

function parseStrictJson(text) {
  // Strip code fences if the model added them despite instructions.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Last-ditch: extract the largest {...} block.
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('anthropic returned non-JSON output');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
