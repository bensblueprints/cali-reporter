'use client';
import { useRouter } from 'next/navigation';
import PostForm from '../../../components/PostForm.jsx';

export default function NewPostPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl mb-8 border-b-2 border-ink pb-3">New post</h1>
      <PostForm
        submitLabel="Publish"
        onSubmit={async (data) => {
          const r = await fetch('/api/admin/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!r.ok) throw new Error((await r.json()).error || 'failed to publish');
          const j = await r.json();
          router.push(`/article/${j.slug}`);
        }}
      />
    </div>
  );
}
