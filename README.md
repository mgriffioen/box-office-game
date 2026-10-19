# Box Office Game

A web version of the Box Office Game from the *Blank Check* podcast. Pick a date (usually the release date of the movie the episode covers) and the players try to name the movies in that weekend's top ten.

## How it plays

- **Round one** has slots 1–5. **Round two** (6–10) unlocks once every top-five slot is guessed or revealed.
- Type into any open slot. Suggestions come from every film Box Office Mojo lists for that year and the year before, so the list doesn't give away the answers. Guess as many times as you like.
- A right answer drops into its correct slot, whichever box you typed it in. If you tick **Guesses must go in the right slot**, it only counts in the right box.
- Naming a 6–10 movie during round one doesn't count as a miss. The game tells you to hold onto it.
- Misses are listed under the board. **Reveal** opens a single slot, and **Give up on this round** reveals the rest of the round.
- Each solved slot shows the gross, distributor, genre, director(s), top-billed cast and plot.

## For hosts

- **Movie you're covering**: search for the film to fill in its US theatrical release date. This needs a TMDB key.
- **Weekend vs. single day**: a weekday date uses that week's Friday–Sunday weekend, so a Wednesday release gets its first full weekend. Choose *Single day* to see the chart for that exact date.
- **Host sheet** tab: the full top ten with all details, hidden behind a click so it isn't shown on stream.
- The page URL (`/?date=2019-07-19&type=weekend`) goes straight to that game, so you can send it to your co-hosts.

## Running it

Requires Node 20.12+.

```sh
npm install
cp .env.example .env   # optional: add a TMDB key
npm start              # http://localhost:3000
npm test
```

### Data sources

- **Box Office Mojo** provides the rankings, grosses and title lists. The server reads the public weekend (`/weekend/2019W29/`), daily (`/date/2019-07-19/`) and yearly (`/year/2019/`) pages. Results are cached in memory for 12 hours. Box Office Mojo has no official API, so a change to its page layout can break this. The parsing is all in `src/boxOfficeMojo.js`.
- **TMDB** (optional) provides the plot, genres, directors, cast, posters and the movie search. Add a free key from <https://www.themoviedb.org/settings/api> as `TMDB_API_KEY` in `.env`. Either the v3 API key or the v4 read access token works. Without a key the game still works, but the cards only show the title and grosses.

This product uses the TMDB API but is not endorsed or certified by TMDB.
