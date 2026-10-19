import * as cheerio from 'cheerio';
import { createCache } from './cache.js';
import { dayLabel, formatISODate, weekendFor, weekendLabel } from './dates.js';

const BASE = 'https://www.boxofficemojo.com';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

export class ChartNotFoundError extends Error {}

const cached = createCache();

async function fetchHtml(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: HEADERS });
  if (res.status === 404) throw new ChartNotFoundError(`No chart found at ${url}`);
  if (!res.ok) throw new Error(`Box Office Mojo responded with ${res.status} for ${url}`);
  return res.text();
}

function parseMoney(text) {
  const digits = String(text).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

// Pull the ranked rows out of a Box Office Mojo weekend or daily chart page.
export function parseChart(html, limit = 10) {
  const $ = cheerio.load(html);
  const table = $('table')
    .filter((_, t) => $(t).find('td.mojo-field-type-rank').length > 0)
    .first();
  if (!table.length) return [];

  const headers = table
    .find('tr')
    .first()
    .children('th')
    .map((_, th) => $(th).text().trim().toLowerCase())
    .get();
  const totalIdx = headers.findIndex((h) => h.includes('total gross') || h.includes('to date'));
  const theatersIdx = headers.findIndex((h) => h.startsWith('theaters'));

  const entries = [];
  table.find('tr').each((_, tr) => {
    const row = $(tr);
    const cells = row.children('td');
    if (!cells.length) return;
    const rank = parseInt(row.find('td.mojo-field-type-rank').first().text(), 10);
    const release = row.find('td.mojo-field-type-release').first();
    const title = release.text().replace(/\s+/g, ' ').trim();
    if (!rank || !title) return;
    const href = release.find('a').attr('href') ?? '';
    entries.push({
      rank,
      title,
      releaseId: href.match(/\/release\/(rl\d+)/)?.[1] ?? null,
      gross: parseMoney(row.find('td.mojo-field-type-money').first().text()),
      totalGross: totalIdx >= 0 ? parseMoney(cells.eq(totalIdx).text()) : null,
      theaters: theatersIdx >= 0 ? parseMoney(cells.eq(theatersIdx).text()) : null,
      distributor: row.find('td.mojo-field-type-release_studios').first().text().trim() || null,
    });
  });

  return entries.sort((a, b) => a.rank - b.rank).slice(0, limit);
}

// Every release title listed on a Box Office Mojo yearly page.
export function parseYearTitles(html) {
  const $ = cheerio.load(html);
  const titles = $('td.mojo-field-type-release')
    .map((_, td) => $(td).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);
  return [...new Set(titles)];
}

// type is "weekend" (the Fri–Sun weekend containing/after date) or "daily".
export function getChart(date, type = 'weekend', { fetchImpl = fetch } = {}) {
  let url, label, startDate, endDate;
  if (type === 'daily') {
    startDate = endDate = formatISODate(date);
    url = `${BASE}/date/${startDate}/`;
    label = dayLabel(date);
  } else {
    const weekend = weekendFor(date);
    startDate = formatISODate(weekend.friday);
    endDate = formatISODate(weekend.sunday);
    url = `${BASE}/weekend/${weekend.id}/`;
    label = weekendLabel(weekend.friday, weekend.sunday);
  }

  return cached(`chart:${url}`, async () => {
    const entries = parseChart(await fetchHtml(url, fetchImpl));
    if (!entries.length) throw new ChartNotFoundError(`No box office chart for ${label}.`);
    return { type, label, startDate, endDate, sourceUrl: url, entries };
  });
}

export function getYearTitles(year, { fetchImpl = fetch } = {}) {
  const url = `${BASE}/year/${year}/`;
  return cached(`year:${url}`, async () => parseYearTitles(await fetchHtml(url, fetchImpl)));
}
