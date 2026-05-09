import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="font-display text-6xl mb-4">404</h1>
      <p className="text-muted mb-8">That story isn't on the page.</p>
      <Link href="/" className="underline decoration-accent decoration-2 underline-offset-4">
        Back to the front page
      </Link>
    </div>
  );
}
