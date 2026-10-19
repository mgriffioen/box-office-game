import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeTitles, findEntry, normalizeTitle, rankSuggestions } from '../public/js/match.js';

test('normalizeTitle ignores case, punctuation, articles, accents and parentheticals', () => {
  assert.equal(normalizeTitle('The Lion King'), 'lion king');
  assert.equal(normalizeTitle('lion king!'), 'lion king');
  assert.equal(normalizeTitle('Mr. & Mrs. Smith'), 'mr and mrs smith');
  assert.equal(normalizeTitle('Amélie'), 'amelie');
  assert.equal(normalizeTitle('Jaws (1975 Re-release)'), 'jaws');
});

test('findEntry matches the chart title or an alternate title', () => {
  const entries = [
    { rank: 1, title: 'Star Wars: Episode VII - The Force Awakens', details: { altTitles: ['Star Wars: The Force Awakens'] } },
    { rank: 2, title: 'Sisters', details: null },
  ];
  assert.equal(findEntry('star wars the force awakens', entries).rank, 1);
  assert.equal(findEntry('The Sisters', entries).rank, 2);
  assert.equal(findEntry('Star Wars', entries), null);
  assert.equal(findEntry('   ', entries), null);
});

test('rankSuggestions puts prefix matches first', () => {
  const pool = ['The Lion King', 'Aladdin', 'Lion', 'The Lighthouse', 'Dark Lion Rising'];
  assert.deepEqual(rankSuggestions('lion', pool), ['Lion', 'The Lion King', 'Dark Lion Rising']);
  assert.deepEqual(rankSuggestions('li', pool, 2), ['Lion', 'The Lion King']);
  assert.deepEqual(rankSuggestions('', pool), []);
});

test('dedupeTitles keeps the first spelling', () => {
  assert.deepEqual(dedupeTitles(['The Lion King', 'Lion King', 'Aladdin']), ['The Lion King', 'Aladdin']);
});
