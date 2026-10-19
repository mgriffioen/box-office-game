const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parse "YYYY-MM-DD" into a UTC midnight Date, or null if it isn't a real date.
export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return formatISODate(date) === value ? date : null;
}

export function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function isoWeek(date) {
  const t = new Date(date.getTime());
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / DAY_MS + 1) / 7) };
}

// The Friday–Sunday weekend a release date belongs to. A Mon–Thu date rolls
// forward to that week's Friday (a Wednesday opening's first weekend); a
// Saturday or Sunday rolls back. Box Office Mojo names weekends by the ISO
// week of the Friday, e.g. 2019W29 for Jul 19–21, 2019.
export function weekendFor(date) {
  const day = date.getUTCDay();
  const offset = day === 6 ? -1 : day === 0 ? -2 : 5 - day;
  const friday = addDays(date, offset);
  const sunday = addDays(friday, 2);
  const { year, week } = isoWeek(friday);
  return { friday, sunday, id: `${year}W${String(week).padStart(2, '0')}` };
}

export function weekendLabel(friday, sunday) {
  const start = `${MONTHS[friday.getUTCMonth()]} ${friday.getUTCDate()}`;
  const end =
    sunday.getUTCMonth() === friday.getUTCMonth()
      ? `${sunday.getUTCDate()}`
      : `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}`;
  return `Weekend of ${start}–${end}, ${sunday.getUTCFullYear()}`;
}

export function dayLabel(date) {
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
