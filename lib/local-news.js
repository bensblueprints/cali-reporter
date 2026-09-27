// Google News RSS provides a current-coverage signal, not measured audience popularity.
const STOP = new Set('the a an and or for to of in on at with from by is are as after over new says san los angeles diego jose francisco fresno'.split(' '));
function words(title) {
  return new Set(String(title || '').split(/\s[-–]\s/)[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2 && !STOP.has(w)) || []);
}
export function coverageMatches(item, signals) {
  const tokens = words(item.title);
  const sources = new Set();
  for (const signal of signals) {
    const other = words(signal.title);
    const shared = [...tokens].filter(w => other.has(w)).length;
    if (shared >= 3 && shared / Math.min(tokens.size, other.size) >= 0.6) {
      sources.add(String(signal.title).split(/\s[-–]\s/).at(-1).toLowerCase());
    }
  }
  return sources.size;
}
export function rankLocalItems(items, signals, now = Date.now()) {
  const fresh = item => { const date=Date.parse(item.isoDate || item.pubDate || ''); return Number.isFinite(date) && date <= now + 3600000 && date >= now - 72*3600000; };
  const recentSignals = signals.filter(fresh);
  return items.filter(fresh).map((item,index) => ({item,index,score:coverageMatches(item,recentSignals)}))
    .sort((a,b) => b.score-a.score || Date.parse(b.item.isoDate || b.item.pubDate)-Date.parse(a.item.isoDate || a.item.pubDate) || a.index-b.index)
    .map(({item,score})=>({...item,localCoverageMatches:score}));
}
export function discardImportedText(item) {
  for (const key of ['content','content:encoded','contentSnippet','content:encodedSnippet','summary']) delete item[key];
}
