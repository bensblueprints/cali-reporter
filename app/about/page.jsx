export const metadata = {
  title: 'About',
  description: 'About Cali Reporter — what we cover, our editorial point of view, and our sources.',
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-magazine">
      <h1 className="font-display text-5xl text-center mb-2">About Cali Reporter</h1>
      <p className="text-center text-muted text-lg mb-10">
        A magazine with a point of view: U.S. national headlines, California politics and culture, and West Coast business — covered with conviction, not with the false neutrality of a wire service.
      </p>

      <h2>What this is</h2>
      <p>
        Cali Reporter is an opinionated daily. We cover the news the way essayists do, not the way press releases do —
        we lead with the actual story, not the official statement. We assume our readers are intelligent and would rather
        argue with a strong take than nod along to a hedge-everything paragraph.
      </p>

      <h2>What we cover</h2>
      <p>
        Four beats: the Iran war and its consequences for the West; California politics and the Newsom administration;
        California's wildfire season and the policy decisions behind it; and the AI datacenter buildout reshaping the
        state's energy and water economy. Refreshes three times a day at 7:30 AM, 12:30 PM, and 6:30 PM Pacific.
      </p>

      <h2>Our standards</h2>
      <p>
        We have a position. We do not have license to invent. Every load-bearing claim in our articles is tied to
        primary reporting from a named source — typically LA Times, SF Chronicle, CalMatters, Sacramento Bee, KTLA,
        Newsmax, or wire services — and linked back to the original. We do not fabricate quotes, attribute positions
        to named officials that aren't in the source record, or push causal claims the underlying reporting doesn't support.
      </p>
      <p>
        We will be wrong. When we are, we will correct the record at the top of the affected article and say what we
        got wrong, not bury it.
      </p>

      <h2>Sources</h2>
      <p>
        We pull from a curated mix of national wire feeds and California-focused publishers. We rewrite in our own voice
        and credit every source by name with a link to the original article. If you are an editor at one of our source
        publications and want a feed delisted, write to us and we will remove it on the next deploy.
      </p>

      <h2>Contact</h2>
      <p>
        Corrections, takedowns, or tips: editor@calireporter.com.
      </p>
    </article>
  );
}
