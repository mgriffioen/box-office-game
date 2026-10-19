import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDetails, getUSReleaseDate, pickBestMatch } from '../src/tmdb.js';

test('pickBestMatch prefers an exact title released before the chart date', () => {
  const results = [
    { id: 1, title: 'The Lion King', original_title: 'The Lion King', release_date: '1994-06-24' },
    { id: 2, title: 'The Lion King', original_title: 'The Lion King', release_date: '2019-07-12' },
    { id: 3, title: 'The Lion King 2', original_title: 'The Lion King 2', release_date: '2019-07-01' },
    { id: 4, title: 'The Lion King', original_title: 'The Lion King', release_date: '2024-12-20' },
  ];
  assert.equal(pickBestMatch('The Lion King', '2019-07-21', results).id, 2);
  assert.equal(pickBestMatch('The Lion King', '1994-07-01', results).id, 1);
  assert.equal(pickBestMatch('Aladdin', '2019-07-21', results), null);
});

function fakeTmdb(routes) {
  return async (url) => {
    const { pathname } = new URL(url);
    const body = routes[pathname.replace('/3', '')];
    return body ? Response.json(body) : new Response('{}', { status: 404 });
  };
}

test('getDetails returns plot, genres, directors and top-billed cast', async () => {
  process.env.TMDB_API_KEY = 'test-key';
  const fetchImpl = fakeTmdb({
    '/search/movie': {
      results: [{ id: 42, title: 'Galaxy Raiders', original_title: 'Galaxy Raiders', release_date: '2019-07-19' }],
    },
    '/movie/42': {
      id: 42,
      title: 'Galaxy Raiders',
      original_title: 'Les Pillards',
      overview: 'Space heist.',
      genres: [{ name: 'Action' }, { name: 'Science Fiction' }],
      release_date: '2019-07-19',
      runtime: 120,
      poster_path: '/p.jpg',
      credits: {
        crew: [
          { job: 'Director', name: 'A. Director' },
          { job: 'Producer', name: 'Not Me' },
        ],
        cast: [5, 1, 2, 3, 4, 0].map((order) => ({ order, name: `Actor ${order}` })),
      },
    },
  });
  const d = await getDetails('Galaxy Raiders', '2019-07-21', { fetchImpl });
  assert.equal(d.overview, 'Space heist.');
  assert.deepEqual(d.genres, ['Action', 'Science Fiction']);
  assert.deepEqual(d.directors, ['A. Director']);
  assert.deepEqual(d.cast, ['Actor 0', 'Actor 1', 'Actor 2', 'Actor 3', 'Actor 4']);
  assert.deepEqual(d.altTitles, ['Les Pillards']);
  assert.equal(d.poster, 'https://image.tmdb.org/t/p/w342/p.jpg');
});

test('getUSReleaseDate prefers the US theatrical date', async () => {
  process.env.TMDB_API_KEY = 'test-key';
  const fetchImpl = fakeTmdb({
    '/movie/7': {
      release_date: '2019-07-09',
      release_dates: {
        results: [
          { iso_3166_1: 'GB', release_dates: [{ type: 3, release_date: '2019-07-10T00:00:00.000Z' }] },
          {
            iso_3166_1: 'US',
            release_dates: [
              { type: 1, release_date: '2019-07-09T00:00:00.000Z' },
              { type: 3, release_date: '2019-07-19T00:00:00.000Z' },
            ],
          },
        ],
      },
    },
  });
  assert.equal(await getUSReleaseDate(7, { fetchImpl }), '2019-07-19');
});
