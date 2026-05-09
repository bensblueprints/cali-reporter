'use client';
import { useState } from 'react';

const CATEGORIES = [
  { slug: 'national',   label: 'National'   },
  { slug: 'california', label: 'California' },
  { slug: 'business',   label: 'Business'   },
];

export default function PostForm({ initial, onSubmit, submitLabel = 'Publish' }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [deck, setDeck] = useState(initial?.deck || '');
  const [contentHtml, setContentHtml] = useState(initial?.content_html || '<p></p>');
  const [heroImage, setHeroImage] = useState(initial?.hero_image || '');
  const [heroAlt, setHeroAlt] = useState(initial?.hero_alt || '');
  const [category, setCategory] = useState(initial?.category || 'national');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  async function generate() {
    if (!title) { setError('Add a title before generating an image.'); return; }
    setGenBusy(true);
    setError('');
    const r = await fetch('/api/admin/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, deck, category }),
    });
    const j = await r.json();
    setGenBusy(false);
    if (!r.ok) { setError(j.error || 'image generation failed'); return; }
    setHeroImage(j.url);
    if (!heroAlt) setHeroAlt(j.alt || title);
  }

  async function submit(e) {
    e.preventDefault();
    if (!heroImage) { setError('A hero image is required.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title, deck, content_html: contentHtml, hero_image: heroImage, hero_alt: heroAlt, category });
    } catch (err) {
      setError(err.message || 'save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="Title">
        <input value={title} onChange={e => setTitle(e.target.value)} required
               className="w-full border border-rule px-3 py-2 font-display text-2xl bg-paper focus:outline-none focus:border-ink" />
      </Field>

      <Field label="Deck (one-line subhead)">
        <input value={deck} onChange={e => setDeck(e.target.value)} maxLength={200}
               className="w-full border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink" />
      </Field>

      <Field label="Category">
        <select value={category} onChange={e => setCategory(e.target.value)}
                className="border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink">
          {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
      </Field>

      <Field label="Hero image">
        <div className="flex gap-2">
          <input value={heroImage} onChange={e => setHeroImage(e.target.value)}
                 placeholder="Paste a URL or click Generate AI image"
                 className="flex-1 border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink" />
          <button type="button" onClick={generate} disabled={genBusy}
                  className="border border-ink px-3 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-50">
            {genBusy ? 'Generating…' : 'Generate AI image'}
          </button>
        </div>
        {heroImage && (
          <div className="mt-3 aspect-[16/9] bg-rule overflow-hidden">
            <img src={heroImage} alt={heroAlt || title} className="h-full w-full object-cover" />
          </div>
        )}
      </Field>

      <Field label="Hero alt text">
        <input value={heroAlt} onChange={e => setHeroAlt(e.target.value)}
               className="w-full border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink" />
      </Field>

      <Field label="Body (HTML)">
        <textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)} rows={16}
                  className="w-full border border-rule px-3 py-2 font-mono text-sm bg-paper focus:outline-none focus:border-ink" />
        <div className="mt-1 text-xs text-muted">
          Use <code>&lt;p&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;blockquote&gt;</code>, <code>&lt;a&gt;</code>. The first paragraph gets a drop cap.
        </div>
      </Field>

      {error && <div className="text-sm text-accent">{error}</div>}

      <div className="flex justify-end">
        <button type="submit" disabled={busy}
                className="bg-ink text-paper px-6 py-2 text-xs uppercase tracking-widest hover:bg-accent disabled:opacity-50">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}
