import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, formatISODate, parseISODate, weekendFor, weekendLabel } from '../src/dates.js';

test('parseISODate accepts real dates only', () => {
  assert.equal(formatISODate(parseISODate('2019-07-19')), '2019-07-19');
  assert.equal(parseISODate('2019-02-30'), null);
  assert.equal(parseISODate('July 19'), null);
  assert.equal(parseISODate(undefined), null);
});

test('weekendFor maps dates to Box Office Mojo weekend ids', () => {
  const cases = {
    '2019-07-19': '2019W29', // Friday opening
    '2019-07-21': '2019W29', // Sunday rolls back
    '2019-04-26': '2019W17',
    '2015-12-18': '2015W51',
    '2019-07-17': '2019W29', // Wednesday rolls forward to its Friday
  };
  for (const [date, id] of Object.entries(cases)) {
    assert.equal(weekendFor(parseISODate(date)).id, id, date);
  }
  const w = weekendFor(parseISODate('2019-07-17'));
  assert.equal(formatISODate(w.friday), '2019-07-19');
  assert.equal(formatISODate(w.sunday), '2019-07-21');
});

test('labels', () => {
  const w = weekendFor(parseISODate('2019-05-31'));
  assert.equal(weekendLabel(w.friday, w.sunday), 'Weekend of May 31–Jun 2, 2019');
  assert.equal(dayLabel(parseISODate('2019-07-19')), 'Friday, Jul 19, 2019');
});
