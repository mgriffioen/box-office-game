import { attachAutocomplete } from './autocomplete.js';
import { dedupeTitles, findEntry, normalizeTitle, rankSuggestions } from './match.js';

const ROUNDS = [
  { name: 'Round one: the top five', ranks: [1, 2, 3, 4, 5] },
  { name: 'Round two: six through ten', ranks: [6, 7, 8, 9, 10] },
];

const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

let game = null;

// ---------- setup ----------

async function getJSON(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

async function initSetup() {
  const dateInput = $('chart-date');
  dateInput.max = new Date().toISOString().slice(0, 10);

  const config = await getJSON('/api/config').catch(() => ({ details: false }));
  if (config.details) {
    $('movie-lookup').hidden = false;
    let timer;
    attachAutocomplete($('movie-search'), {
      minLength: 2,
      source: (q) =>
        new Promise((resolve) => {
          clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const { results } = await getJSON(`/api/search?q=${encodeURIComponent(q)}`);
              resolve(results.map((m) => ({ label: m.title, detail: m.releaseDate?.slice(0, 4) ?? '', value: m })));
            } catch {
              resolve([]);
            }
          }, 250);
        }),
      onPick: async ({ value }) => {
        setStatus(`Looking up the US release date for ${value.title}…`);
        try {
          const { date } = await getJSON(`/api/release-date?id=${value.id}`);
          if (!date) throw new Error('No release date on file.');
          dateInput.value = date;
          setStatus(`${value.title} opened in the US on ${date}.`);
        } catch (err) {
          setStatus(err.message, true);
        }
      },
    });
  }

  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadGame(dateInput.value, $('chart-type').value);
  });

  // Shared links (?date=2019-07-19&type=weekend) start the game directly.
  const params = new URLSearchParams(location.search);
  if (params.get('date')) {
    dateInput.value = params.get('date');
    $('chart-type').value = params.get('type') === 'daily' ? 'daily' : 'weekend';
    loadGame(dateInput.value, $('chart-type').value);
  }
}

function setStatus(message, isError = false) {
  const el = $('setup-status');
  el.textContent = message;
  el.classList.toggle('error', isError);
}

async function loadGame(date, type) {
  if (!date) return setStatus('Pick a date first.', true);
  setStatus('Fetching the chart…');
  try {
    const [chart, { titles }] = await Promise.all([
      getJSON(`/api/chart?date=${date}&type=${type}`),
      getJSON(`/api/titles?date=${date}`).catch(() => ({ titles: [] })),
    ]);
    game = {
      chart,
      pool: dedupeTitles([...titles, ...chart.entries.map((e) => e.title)]).sort(),
      round: 0,
      found: new Set(),
      revealed: new Set(),
      misses: [],
    };
    history.replaceState(null, '', `?date=${date}&type=${type}`);
    setStatus('');
    startGame();
  } catch (err) {
    setStatus(err.message, true);
  }
}

// ---------- game ----------

function startGame() {
  const { chart } = game;
  $('setup').hidden = true;
  $('game').hidden = false;
  $('chart-label').textContent = `${chart.type === 'daily' ? 'Daily chart' : 'Weekend chart'}: ${chart.label}`;
  $('chart-source').href = chart.sourceUrl;
  $('details-note').hidden = chart.detailsAvailable;
  $('host-gate').hidden = false;
  $('host-list').hidden = true;
  selectTab('play');
  setFeedback('');
  renderHost();
  render();
  focusFirstGuess();
}

const entryAt = (rank) => game.chart.entries.find((e) => e.rank === rank);
const roundRanks = (i) => ROUNDS[i].ranks.filter(entryAt);
const isDone = (rank) => game.found.has(rank) || game.revealed.has(rank);
const roundComplete = (i) => roundRanks(i).every(isDone);

function advanceIfComplete() {
  if (game.round === 0 && roundComplete(0) && roundRanks(1).length) {
    game.round = 1;
    return true;
  }
  return false;
}

function submitGuess(text, slotRank) {
  const guess = text.trim();
  if (!guess) return;
  const active = roundRanks(game.round);
  const entry = findEntry(guess, game.chart.entries);
  const strict = $('strict-mode').checked;

  if (!entry) {
    recordMiss(guess);
    return setFeedback(`Nope, “${guess}” isn't in the top ten.`, 'miss');
  }
  if (isDone(entry.rank)) {
    return setFeedback(`#${entry.rank} ${entry.title} is already on the board.`, 'info');
  }
  if (!active.includes(entry.rank)) {
    return setFeedback(`${entry.title} is in the top ten, but not the top five. Hang onto it for round two!`, 'info');
  }
  if (strict && entry.rank !== slotRank) {
    recordMiss(`${guess} (at #${slotRank})`);
    return setFeedback(`${entry.title} made the top five, but not at #${slotRank}.`, 'miss');
  }

  game.found.add(entry.rank);
  const advanced = advanceIfComplete();
  setFeedback(
    `Yes! ${entry.title} was #${entry.rank}` +
      (entry.gross ? ` with ${money.format(entry.gross)}.` : '.') +
      (advanced ? ' On to six through ten.' : ''),
    'hit',
  );
  render();
  focusFirstGuess();
}

function recordMiss(guess) {
  if (!game.misses.some((m) => normalizeTitle(m) === normalizeTitle(guess))) game.misses.push(guess);
  renderMisses();
}

function reveal(ranks) {
  for (const rank of ranks) if (!game.found.has(rank)) game.revealed.add(rank);
  const advanced = advanceIfComplete();
  setFeedback(advanced ? 'Revealed. On to six through ten.' : 'Revealed.', 'info');
  render();
  focusFirstGuess();
}

function setFeedback(message, kind = '') {
  const el = $('feedback');
  el.textContent = message;
  el.className = `feedback ${kind}`;
}

function focusFirstGuess() {
  $('slots').querySelector('input')?.focus();
}

// ---------- rendering ----------

function render() {
  const allDone = game.chart.entries.every((e) => isDone(e.rank));
  $('round-heading').textContent = allDone ? 'Final board' : ROUNDS[game.round].name;
  $('give-up').hidden = allDone;
  $('slots').replaceChildren(...game.chart.entries.map((entry) => renderSlot(entry)));
  renderMisses();
  if (allDone) {
    const got = game.found.size;
    setFeedback(
      `Final score: ${got} of ${game.chart.entries.length} guessed, ${game.misses.length} ` +
        `miss${game.misses.length === 1 ? '' : 'es'}.`,
      got >= game.chart.entries.length / 2 ? 'hit' : 'info',
    );
  }
}

function renderSlot(entry) {
  const li = document.createElement('li');
  li.className = 'slot';
  const rank = document.createElement('span');
  rank.className = 'slot-rank';
  rank.textContent = entry.rank;
  li.append(rank);

  if (isDone(entry.rank)) {
    li.classList.add(game.found.has(entry.rank) ? 'found' : 'revealed');
    const card = movieCard(entry);
    if (game.revealed.has(entry.rank)) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'Revealed';
      card.querySelector('.card-title').append(' ', tag);
    }
    li.append(card);
  } else if (roundRanks(game.round).includes(entry.rank)) {
    li.classList.add('open');
    li.append(guessForm(entry.rank));
  } else {
    li.classList.add('locked');
    const msg = document.createElement('span');
    msg.className = 'locked-msg';
    msg.textContent = 'Unlocks after the top five';
    li.append(msg);
  }
  return li;
}

function guessForm(rank) {
  const form = document.createElement('form');
  form.className = 'guess';
  form.autocomplete = 'off';
  const combo = document.createElement('div');
  combo.className = 'combo';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a movie title…';
  input.setAttribute('aria-label', `Guess for #${rank}`);
  combo.append(input);
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary';
  submit.textContent = 'Guess';
  const revealBtn = document.createElement('button');
  revealBtn.type = 'button';
  revealBtn.className = 'link';
  revealBtn.textContent = 'Reveal';
  revealBtn.addEventListener('click', () => reveal([rank]));
  form.append(combo, submit, revealBtn);

  attachAutocomplete(input, {
    source: (q) => rankSuggestions(q, game.pool).map((title) => ({ label: title })),
    onPick: (item) => {
      submitGuess(item.label, rank);
      input.value = '';
    },
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitGuess(input.value, rank);
    input.value = '';
  });
  return form;
}

function movieCard(entry, { full = false } = {}) {
  const card = $('movie-card').content.firstElementChild.cloneNode(true);
  const d = entry.details;
  const poster = card.querySelector('.poster');
  if (d?.poster) poster.src = d.poster;
  else poster.remove();

  card.querySelector('.card-title').textContent = entry.title;
  const moneyParts = [];
  if (entry.gross) moneyParts.push(`${money.format(entry.gross)} ${game.chart.type === 'daily' ? 'that day' : 'that weekend'}`);
  if (entry.totalGross) moneyParts.push(`${money.format(entry.totalGross)} to date`);
  if (entry.distributor) moneyParts.push(entry.distributor);
  card.querySelector('.card-money').textContent = moneyParts.join(' · ');

  const setOrRemove = (sel, text) => {
    const el = card.querySelector(sel);
    if (text) el.textContent = text;
    else el.remove();
  };
  setOrRemove('.card-genres', d?.genres?.join(', '));
  const credits = [];
  if (d?.directors?.length) credits.push(`Directed by ${d.directors.join(', ')}`);
  if (d?.cast?.length) credits.push(`Starring ${d.cast.join(', ')}`);
  setOrRemove('.card-credits', credits.join('. '));
  setOrRemove('.card-overview', d?.overview);
  if (full) card.classList.add('full');
  return card;
}

function renderMisses() {
  $('misses-wrap').hidden = game.misses.length === 0;
  $('miss-count').textContent = game.misses.length;
  $('misses').replaceChildren(
    ...game.misses.map((m) => {
      const li = document.createElement('li');
      li.textContent = m;
      return li;
    }),
  );
}

function renderHost() {
  $('host-list').replaceChildren(
    ...game.chart.entries.map((entry) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'slot-rank';
      rank.textContent = entry.rank;
      li.append(rank, movieCard(entry, { full: true }));
      return li;
    }),
  );
}

function selectTab(name) {
  for (const tab of ['play', 'host']) {
    $(`tab-${tab}`).setAttribute('aria-selected', String(tab === name));
    $(`${tab}-panel`).hidden = tab !== name;
  }
}

// ---------- wiring ----------

$('tab-play').addEventListener('click', () => selectTab('play'));
$('tab-host').addEventListener('click', () => selectTab('host'));
$('host-reveal').addEventListener('click', () => {
  $('host-gate').hidden = true;
  $('host-list').hidden = false;
});
$('give-up').addEventListener('click', () => reveal(roundRanks(game.round)));
$('new-game').addEventListener('click', () => {
  game = null;
  history.replaceState(null, '', location.pathname);
  $('game').hidden = true;
  $('setup').hidden = false;
});
$('strict-mode').addEventListener('change', focusFirstGuess);

initSetup();
