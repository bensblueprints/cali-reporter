export const metadata = {
  title: 'About',
  description: 'About Cali Reporter and our editorial process.',
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-magazine">
      <h1 className="font-display text-5xl text-center mb-2">About Cali Reporter</h1>
      <p className="text-center text-muted text-lg mb-10">
        A small newsroom built around three things: U.S. national headlines, California politics and culture, and West Coast business.
      </p>

      <h2>How we publish</h2>
      <p>
        Cali Reporter refreshes three times a day at 7:30 AM, 12:30 PM, and 6:30 PM Pacific. Each refresh pulls
        from a curated list of trusted RSS sources, drafts an original rewrite in our house voice, and credits
        the source publication directly under the deck.
      </p>

      <h2>Our sources</h2>
      <p>
        We pull from a mix of national wire-style feeds and California-focused publishers — including LA Times,
        SF Chronicle, CalMatters, Sacramento Bee, KTLA, and others. Every aggregated story includes a clear
        source attribution and a link back to the original article.
      </p>

      <h2>Editorial standards</h2>
      <p>
        We do not invent facts, names, numbers, or quotes. Our rewrites are summary plus context plus link —
        the lowest-risk form of news aggregation, and the form most respectful of the publishers we rely on.
        If you are an editor at one of our source publications and want a feed delisted, write to us and we
        will remove it on the next deploy.
      </p>

      <h2>Contact</h2>
      <p>
        For corrections, takedowns, or tips: editor@calireporter.com.
      </p>
    </article>
  );
}
