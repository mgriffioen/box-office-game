import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

class ChartNotFoundError extends Error {}

const chart = {
  type: 'weekend',
  label: 'Weekend of Jul 19–21, 2019',
  startDate: '2019-07-19',
  endDate: '2019-07-21',
  sourceUrl: 'https://www.boxofficemojo.com/weekend/2019W29/',
  entries: [
    { rank: 1, title: 'Galaxy Raiders', gross: 1 },
    { rank: 2, title: 'Desert Kings', gross: 2 },
  ],
};

async function withServer(deps, fn) {
  const server = createApp(deps).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

const mojo = {
  ChartNotFoundError,
  getChart: async (date) => {
    if (date.getUTCFullYear() === 1980) throw new ChartNotFoundError('No chart.');
    return chart;
  },
  getYearTitles: async (year) => (year === 2019 ? ['Galaxy Raiders', 'Desert Kings'] : ['The Old One', 'galaxy raiders']),
};

test('chart endpoint adds details when TMDB is configured', async () => {
  const tmdb = {
    isConfigured: () => true,
    getDetails: async (title) => {
      if (title === 'Desert Kings') throw new Error('boom');
      return { overview: `About ${title}` };
    },
  };
  await withServer({ mojo, tmdb }, async (base) => {
    const res = await fetch(`${base}/api/chart?date=2019-07-19&type=weekend`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.detailsAvailable, true);
    assert.equal(body.entries[0].details.overview, 'About Galaxy Raiders');
    assert.equal(body.entries[1].details, null);
  });
});

test('chart endpoint validates input and reports missing charts', async () => {
  const tmdb = { isConfigured: () => false };
  await withServer({ mojo, tmdb }, async (base) => {
    assert.equal((await fetch(`${base}/api/chart?date=nope`)).status, 400);
    assert.equal((await fetch(`${base}/api/chart?date=1980-05-02`)).status, 404);
    assert.equal((await fetch(`${base}/api/chart?date=2999-01-01`)).status, 400);
    const ok = await (await fetch(`${base}/api/chart?date=2019-07-19`)).json();
    assert.equal(ok.detailsAvailable, false);
    assert.equal(ok.entries[0].details, null);
    assert.equal((await fetch(`${base}/api/search?q=x`)).status, 501);
  });
});

test('titles endpoint merges this year and last year', async () => {
  const tmdb = { isConfigured: () => false };
  await withServer({ mojo, tmdb }, async (base) => {
    const body = await (await fetch(`${base}/api/titles?date=2019-07-19`)).json();
    assert.deepEqual(body.titles, ['Galaxy Raiders', 'Desert Kings', 'The Old One']);
  });
});
