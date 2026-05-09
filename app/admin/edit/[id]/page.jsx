'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PostForm from '../../../../components/PostForm.jsx';

export default function EditPostPage({ params }) {
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/posts/${params.id}`).then(async r => {
      if (r.status === 401) { router.push('/admin/login'); return; }
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'load failed'); return; }
      setPost(j.post);
    });
  }, [params.id]);

  if (error) return <div className="mx-auto max-w-2xl px-4 py-12 text-accent">{error}</div>;
  if (!post) return <div className="mx-auto max-w-2xl px-4 py-12 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl mb-8 border-b-2 border-ink pb-3">Edit post</h1>
      <PostForm
        initial={post}
        submitLabel="Save"
        onSubmit={async (data) => {
          const r = await fetch(`/api/admin/posts/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!r.ok) throw new Error((await r.json()).error || 'save failed');
          router.push('/admin');
        }}
      />
    </div>
  );
}
