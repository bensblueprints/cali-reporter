'use client';

import { useEffect, useRef, useState } from 'react';

const buttonClass = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded border border-rule px-3 text-sm text-ink hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function Icon({ platform }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    {platform === 'Facebook' && <path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.6 1.3 16.4 1 15 1c-3 0-5 1.9-5 5.4V9H7v4h3v9z" />}
    {platform === 'Instagram' && <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2"/></>}
    {platform === 'X' && <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l8.1-9.3L.8 2h6.5l5.1 6.8L18.9 2zm-1.1 18h1.7L6.4 3.9H4.6L17.8 20z"/>}
    {platform === 'Reddit' && <><ellipse cx="12" cy="14" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m12 8 1.5-5 4 1" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="19" cy="4" r="2"/><circle cx="8.5" cy="13" r="1.5"/><circle cx="15.5" cy="13" r="1.5"/><path d="M8 16c2 2 6 2 8 0" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="3" cy="10" r="2"/><circle cx="21" cy="10" r="2"/></>}
  </svg>;
}

export default function ArticleShare({ title, url }) {
  const [message, setMessage] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  useEffect(() => { if (manualCopy) { input.current?.focus(); input.current?.select(); } }, [manualCopy]);

  async function shareInstagram() {
    if (busy) return;
    setBusy(true); setMessage(''); setManualCopy(false);
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, url });
          return;
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setMessage('Link copied. Paste it into an Instagram message or a Story link.');
      } catch {
        setManualCopy(true);
        setMessage('Copy this link to paste into an Instagram message or a Story link.');
      }
    } finally { setBusy(false); }
  }

  const links = {
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    X: `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    Reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  };
  return <div className="min-w-0 max-w-full" data-article-share>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this article">
      <span className="text-xs uppercase tracking-widest text-muted mr-1">Share</span>
      {['Facebook', 'Instagram', 'X', 'Reddit'].map(platform => platform === 'Instagram' ?
        <button key={platform} type="button" className={buttonClass} onClick={shareInstagram} disabled={busy}
          aria-label="Share for Instagram: device share menu or copy link" title="Instagram: use your device share menu or copy the link">
          <Icon platform={platform}/><span className="hidden sm:inline">{platform}</span>
        </button> :
        <a key={platform} className={buttonClass} href={links[platform]} target="_blank" rel="noopener noreferrer"
          aria-label={`Share on ${platform} (opens a new tab)`} title={`Share on ${platform}`}>
          <Icon platform={platform}/><span className="hidden sm:inline">{platform}</span>
        </a>
      )}
    </div>
    <p role="status" aria-live="polite" className={message ? 'mt-2 max-w-sm text-sm text-muted' : 'sr-only'}>{message}</p>
    {manualCopy && <input ref={input} aria-label="Article link to copy" readOnly value={url}
      onFocus={event => event.target.select()} className="mt-2 w-full min-w-0 rounded border border-rule bg-paper p-2 text-sm"/>}
  </div>;
}
