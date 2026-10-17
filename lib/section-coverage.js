// Named AI writer identities for city coverage; stable desk slugs preserve existing links.
export const CITY_WRITER_NAMES = {
  'los-angeles': 'Maya Chen',
  'san-diego': 'Lucas Bennett',
  'san-jose': 'Nina Patel',
  'san-francisco': 'Avery Brooks',
  'fresno': 'Elena Cruz',
};
const DEFAULT_DESK_VOICE = 'Write concise, original, factual summaries with source attribution. Never imply first-hand reporting, professional credentials or interviews. Distinguish research findings from personal advice.';
export const CITY_WRITER_VOICES = {
  'los-angeles': 'Clear, energetic civic reporting. Start with the concrete change affecting a neighborhood, then explain the decision and the people responsible. Use specific places and concise transitions, with no invented scene-setting.',
  'san-diego': 'Patient, practical explanation. Walk readers through what changed, how a public process works and the documented next steps. Use a calm tone and define unfamiliar local-government terms.',
  'san-jose': 'Analytical and accessible. Connect technology, housing and civic decisions to their documented everyday consequences. Explain competing tradeoffs using concrete details from the source.',
  'san-francisco': 'Measured, probing and precise. Separate official claims from documented findings; explain who has decision-making authority and what remains unresolved. Prefer restrained prose over dramatic framing.',
  'fresno': 'Direct, grounded Central Valley coverage. Lead with the practical local stakes, explain costs and public services in plain language, and give sourced community perspectives room without adding sentiment.',
};
export const SECTION_DESKS = [
  ['los-angeles', 'Los Angeles'], ['san-diego', 'San Diego'],
  ['san-jose', 'San Jose'], ['san-francisco', 'San Francisco'],
  ['fresno', 'Fresno'], ['health', 'Health & Nutrition'],
  ['relationships', 'Love & Relationships'],
].map(([category, label]) => ({ category, slug: `${category}-desk`, name: CITY_WRITER_NAMES[category] || `${label} Desk`,
  beat: label,
  bio: CITY_WRITER_NAMES[category]
    ? `${CITY_WRITER_NAMES[category]} is Cali Reporter's named AI writer for ${label}. This is an AI-assisted editorial identity, not a human reporter. Articles are prepared from attributed sources; the name does not imply on-the-ground reporting, interviews or professional credentials.`
    : `Cali Reporter's AI-assisted ${label} desk publishes source-linked briefs and practical explainers. This is an editorial desk identity, not an individual reporter or a claim of professional credentials.`,
  voice: CITY_WRITER_VOICES[category] || DEFAULT_DESK_VOICE }));

export function seedSectionWriters(db) {
  const upsert = db.prepare(`INSERT INTO authors (slug,name,role,desk,beat,bio,voice_prompt)
    VALUES (@slug,@name,'desk',@category,@beat,@bio,@voice)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name,role=excluded.role,
    desk=excluded.desk,beat=excluded.beat,bio=excluded.bio,
    voice_prompt=CASE WHEN authors.voice_prompt IS NULL OR trim(authors.voice_prompt)='' OR authors.voice_prompt=@generic
      THEN excluded.voice_prompt ELSE authors.voice_prompt END`);
  db.transaction(() => { for (const desk of SECTION_DESKS) upsert.run({...desk,generic:DEFAULT_DESK_VOICE}); })();
}
export function sectionWriter(db, category) {
  return db.prepare('SELECT * FROM authors WHERE slug = ?').get(`${category}-desk`);
}
// Least recently covered section first; empty sections precede populated ones.
// Round-robin feeds within those sections prevents a desk with many sources dominating.
export function orderFeeds(feeds, coverage) {
  const last = new Map(coverage.map(row => [row.category, row.latest || '']));
  const groups = new Map();
  for (const feed of feeds) {
    if (!groups.has(feed.category)) groups.set(feed.category, []);
    groups.get(feed.category).push(feed);
  }
  const categories = [...groups.keys()].sort((a,b) => (last.get(a)||'').localeCompare(last.get(b)||''));
  const ordered = [];
  for (let i=0; categories.some(c => groups.get(c)[i]); i++) {
    for (const c of categories) if (groups.get(c)[i]) ordered.push(groups.get(c)[i]);
  }
  return ordered;
}
export function relevantFeedItem(feed, item, now = Date.now()) {
  if (feed.exclude && new RegExp(feed.exclude,'i').test(item.link || '')) return false;
  const published = Date.parse(item.isoDate || item.pubDate || '');
  if (Number.isFinite(published) && (published > now + 3600000 || now - published > 14*86400000)) return false;
  if (!feed.match) return true;
  return new RegExp(feed.match, 'i').test([item.title,item.contentSnippet,item.content,item.summary].filter(Boolean).join(' '));
}
