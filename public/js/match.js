// Title matching shared by the browser and the server.

const LEADING_ARTICLE = /^(the|a|an) /;

// Reduce a title to a comparable form: case, accents, punctuation,
// parentheticals like "(2019 Re-release)" and a leading article are ignored.
export function normalizeTitle(title) {
  return String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');
}

// Every normalized title a chart entry answers to.
export function entryTitles(entry) {
  return [entry.title, ...(entry.details?.altTitles ?? [])]
    .map(normalizeTitle)
    .filter(Boolean);
}

export function findEntry(guess, entries) {
  const g = normalizeTitle(guess);
  if (!g) return null;
  return entries.find((entry) => entryTitles(entry).includes(g)) ?? null;
}

// Suggestions for the autocomplete: titles starting with the query first,
// then titles with a word starting with it, then any substring match.
export function rankSuggestions(query, pool, limit = 8) {
  const q = normalizeTitle(query);
  if (!q) return [];
  const scored = [];
  for (const title of pool) {
    const t = normalizeTitle(title);
    let score;
    if (t === q) score = 0;
    else if (t.startsWith(q)) score = 1;
    else if (` ${t}`.includes(` ${q}`)) score = 2;
    else if (t.includes(q)) score = 3;
    else continue;
    scored.push({ title, score });
  }
  scored.sort((a, b) => a.score - b.score || a.title.length - b.title.length || a.title.localeCompare(b.title));
  return scored.slice(0, limit).map((s) => s.title);
}

// Merge title lists, dropping entries that normalize to the same thing.
export function dedupeTitles(titles) {
  const seen = new Set();
  const out = [];
  for (const title of titles) {
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}
