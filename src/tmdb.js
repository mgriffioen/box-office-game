import { createCache } from './cache.js';
import { normalizeTitle } from '../public/js/match.js';
import { parseISODate } from './dates.js';

const API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const DAY_MS = 86_400_000;

const cached = createCache({ ttlMs: 7 * 24 * 60 * 60 * 1000 });

export function isConfigured() {
  return Boolean(process.env.TMDB_API_KEY);
}

async function tmdbGet(path, params = {}, fetchImpl = fetch) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set');
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = { Accept: 'application/json' };
  // v4 read access tokens are JWTs; v3 keys go in the query string.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  const res = await fetchImpl(url, { headers });
  if (!res.ok) throw new Error(`TMDB responded with ${res.status} for ${path}`);
  return res.json();
}

export async function searchMovies(query, { fetchImpl } = {}) {
  const data = await tmdbGet('/search/movie', { query, include_adult: 'false' }, fetchImpl);
  return data.results.slice(0, 10).map((m) => ({
    id: m.id,
    title: m.title,
    releaseDate: m.release_date || null,
  }));
}

// Choose the search result that best fits a chart entry: the title should
// match, and the film should have come out on or before the chart date
// (box office charts are mostly new releases and recent holdovers).
export function pickBestMatch(title, chartDate, results) {
  const wanted = normalizeTitle(title);
  const chartTime = parseISODate(chartDate)?.getTime() ?? Date.now();
  let best = null;
  let bestScore = -Infinity;
  for (const r of results) {
    const released = parseISODate(r.release_date)?.getTime();
    if (released === undefined) continue;
    const daysBefore = (chartTime - released) / DAY_MS;
    // Allow a couple of weeks of slack for differing international dates.
    if (daysBefore < -14) continue;
    const names = [r.title, r.original_title].map(normalizeTitle);
    let score = 0;
    if (names.includes(wanted)) score += 100;
    else if (names.some((n) => n.startsWith(wanted) || wanted.startsWith(n))) score += 20;
    else continue;
    score -= Math.min(Math.abs(daysBefore) / 30, 60);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

// Plot, genre, directors, top-billed cast and poster for a chart entry.
export function getDetails(title, chartDate, { fetchImpl } = {}) {
  return cached(`details:${title}:${chartDate}`, async () => {
    const query = title.replace(/\(.*?\)/g, '').trim();
    const search = await tmdbGet('/search/movie', { query, include_adult: 'false' }, fetchImpl);
    const match = pickBestMatch(title, chartDate, search.results);
    if (!match) return null;

    const movie = await tmdbGet(`/movie/${match.id}`, { append_to_response: 'credits' }, fetchImpl);
    const altTitles = [...new Set([movie.title, movie.original_title])].filter(
      (t) => t && normalizeTitle(t) !== normalizeTitle(title),
    );
    return {
      tmdbId: movie.id,
      overview: movie.overview || null,
      genres: movie.genres.map((g) => g.name),
      directors: movie.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name),
      cast: [...movie.credits.cast]
        .sort((a, b) => a.order - b.order)
        .slice(0, 5)
        .map((c) => c.name),
      releaseDate: movie.release_date || null,
      runtime: movie.runtime || null,
      poster: movie.poster_path ? IMAGE_BASE + movie.poster_path : null,
      altTitles,
    };
  });
}

// The film's US theatrical release date, falling back to its primary date.
export async function getUSReleaseDate(id, { fetchImpl } = {}) {
  const data = await tmdbGet(`/movie/${id}`, { append_to_response: 'release_dates' }, fetchImpl);
  const us = data.release_dates.results.find((r) => r.iso_3166_1 === 'US');
  const dates = (type) =>
    (us?.release_dates ?? [])
      .filter((d) => d.type === type)
      .map((d) => d.release_date.slice(0, 10))
      .sort();
  return dates(3)[0] ?? dates(2)[0] ?? data.release_date ?? null;
}
