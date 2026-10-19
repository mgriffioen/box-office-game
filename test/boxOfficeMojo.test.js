import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChartNotFoundError, getChart, parseChart, parseYearTitles } from '../src/boxOfficeMojo.js';
import { parseISODate } from '../src/dates.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('parseChart reads the top ten rows', () => {
  const entries = parseChart(fixture('weekend.html'));
  assert.equal(entries.length, 10);
  assert.deepEqual(entries[0], {
    rank: 1,
    title: 'Galaxy Raiders',
    releaseId: 'rl1001',
    gross: 33_000_123,
    totalGross: 99_000_000,
    theaters: 3_900,
    distributor: 'Studio 1',
  });
  assert.equal(entries[2].title, 'Mr. & Mrs. Midnight');
  assert.equal(entries[9].rank, 10);
});

test('parseChart returns nothing for a page without a chart', () => {
  assert.deepEqual(parseChart('<html><body><p>No data</p></body></html>'), []);
});

test('parseYearTitles lists unique release titles', () => {
  assert.deepEqual(parseYearTitles(fixture('year.html')), ['Galaxy Raiders', 'Desert Kings', 'Another Film']);
});

test('getChart builds the weekend URL and label', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return new Response(fixture('weekend.html'));
  };
  const chart = await getChart(parseISODate('2019-07-17'), 'weekend', { fetchImpl });
  assert.deepEqual(urls, ['https://www.boxofficemojo.com/weekend/2019W29/']);
  assert.equal(chart.label, 'Weekend of Jul 19–21, 2019');
  assert.equal(chart.startDate, '2019-07-19');
  assert.equal(chart.entries.length, 10);
});

test('getChart uses the daily URL and reports missing charts', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return new Response('not found', { status: 404 });
  };
  await assert.rejects(getChart(parseISODate('1990-03-02'), 'daily', { fetchImpl }), ChartNotFoundError);
  assert.deepEqual(urls, ['https://www.boxofficemojo.com/date/1990-03-02/']);
});

test('getChart explains when an old weekend has no chart', async () => {
  const fetchImpl = async () => new Response('<html><body><p>No data</p></body></html>');
  await assert.rejects(getChart(parseISODate('1975-06-20'), 'weekend', { fetchImpl }), {
    name: 'Error',
    message: "Box Office Mojo doesn't have a chart for the weekend of Jun 20–22, 1975. Older releases often aren't covered.",
  });
});
