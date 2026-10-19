import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as defaultMojo from './boxOfficeMojo.js';
import * as defaultTmdb from './tmdb.js';
import { dedupeTitles } from '../public/js/match.js';
import { parseISODate } from './dates.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const EARLIEST_YEAR = 1977;

export function createApp({ mojo = defaultMojo, tmdb = defaultTmdb } = {}) {
  const app = express();

  app.get('/api/config', (_req, res) => {
    res.json({ details: tmdb.isConfigured() });
  });

  // The top ten for a weekend or day, with movie details when TMDB is set up.
  app.get('/api/chart', async (req, res) => {
    const date = parseISODate(req.query.date);
    const type = req.query.type === 'daily' ? 'daily' : 'weekend';
    if (!date) return res.status(400).json({ error: 'Pick a date (YYYY-MM-DD).' });
    if (date.getUTCFullYear() < EARLIEST_YEAR || date > new Date()) {
      return res.status(400).json({ error: `Pick a date between ${EARLIEST_YEAR} and today.` });
    }

    let chart;
    try {
      chart = await mojo.getChart(date, type);
    } catch (err) {
      if (err instanceof mojo.ChartNotFoundError) return res.status(404).json({ error: err.message });
      console.error(err);
      return res.status(502).json({ error: 'Could not reach Box Office Mojo. Try again in a bit.' });
    }

    let detailsAvailable = tmdb.isConfigured();
    const entries = await Promise.all(
      chart.entries.map(async (entry) => {
        if (!detailsAvailable) return { ...entry, details: null };
        try {
          return { ...entry, details: await tmdb.getDetails(entry.title, chart.endDate) };
        } catch (err) {
          console.error(`Details lookup failed for "${entry.title}":`, err.message);
          return { ...entry, details: null };
        }
      }),
    );
    res.json({ ...chart, entries, detailsAvailable });
  });

  // Titles for the guess autocomplete: everything released that year and the
  // year before (holdovers), so the list doesn't give the answers away.
  app.get('/api/titles', async (req, res) => {
    const date = parseISODate(req.query.date);
    if (!date) return res.status(400).json({ error: 'Pick a date (YYYY-MM-DD).' });
    const year = date.getUTCFullYear();
    const lists = await Promise.allSettled([mojo.getYearTitles(year), mojo.getYearTitles(year - 1)]);
    for (const r of lists) if (r.status === 'rejected') console.error(r.reason.message);
    res.json({ titles: dedupeTitles(lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))) });
  });

  // Host helper: find a movie to get its US release date.
  app.get('/api/search', async (req, res) => {
    if (!tmdb.isConfigured()) return res.status(501).json({ error: 'Movie search needs a TMDB_API_KEY.' });
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ results: [] });
    try {
      res.json({ results: await tmdb.searchMovies(q) });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: 'Movie search failed.' });
    }
  });

  app.get('/api/release-date', async (req, res) => {
    if (!tmdb.isConfigured()) return res.status(501).json({ error: 'Movie search needs a TMDB_API_KEY.' });
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad movie id.' });
    try {
      res.json({ date: await tmdb.getUSReleaseDate(id) });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: 'Release date lookup failed.' });
    }
  });

  app.use(express.static(PUBLIC_DIR));
  return app;
}
