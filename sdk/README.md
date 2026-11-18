# @keros3ne/studio-sdk

Build games for KEROS3NE, a social casino played with play money. This is the contract every
studio game is held to, and the tools to build one: how a game's outcomes are made into
books, the client's bridge to the site, the stage, the control bar and controls, Storybook,
the site's own checks, and `keros3ne-studio`, the command line to make a game's books, check
it and play it.

A studio's game can be far richer than the site's own: its own graphics and sound, bonuses
a player takes part in, meters that last between bets, its own controls. It is still held
to every rule of the site, below.

This repository is also where a studio starts: clone it, and it is a complete small studio,
Tidewater Games, with one slot, Harbour Lights, and everything a studio sends (the README
at its top says how). A studio takes the SDK's updates by merging this repository into its
own.

## The shape of it

A game has two halves, kept apart on purpose.

| Half       | What it is                                    | Where it runs                                     | What it may do                                                 |
| ---------- | --------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| **Maths**  | Code that plays rounds, to make books of them | Where its books are made. Never on the site.      | Read the random stream it is handed. Nothing else.             |
| **Client** | The game as the player sees it                | In the player's browser, inside a sandboxed frame | Draw, play sound, and ask the site to act. It decides nothing. |

What the site plays a game from is its **books**: for each way of opening a round, a table
of rows, each with a whole-number weight, what it pays and the events that play it out. The
site draws a row from a bet's seeds. It has none of your code, and runs none.

Your game never touches a balance. The client cannot place a bet: it asks the page around
it, which checks the request and plays the round through the same pipeline as every game.

## A studio's folder

```
studio.json                 the studio, and its games in order
<slug>/game.json            the game: its name, blurb, section, modes and counters
<slug>/guide.json           its rules and paytable, as data
<slug>/maths/index.ts       how each table's rounds play out (exports defineBooks(...))
<slug>/maths/*.spec.ts      your own tests of its rules
<slug>/books/books.json     what each table comes to: commit it
<slug>/books/*.index, *.rows   the books themselves: not committed
<slug>/client/              the client: index.html, src/, public/card.svg
<shared>/                   anything the clients share, named in studio.json's "shared"
```

`studio.json`:

```json
{
	"id": "tidewater",
	"name": "Tidewater Games",
	"blurb": "Slots from the coast.",
	"url": "https://tidewater.example",
	"sdk": "^0.11.0",
	"games": ["harbour-lights", "undertow"]
}
```

- `id` is how the site knows your studio: lowercase words joined by hyphens.
- `name` and `blurb` are shown where your games are listed; `url`, if given, is linked
  (https only).
- `sdk` is the version of this SDK you built on, as a range. `check` fails a manifest for
  another version.
- `games` lists your games by slug, in the order they are listed. Each is a folder beside
  the manifest, laid out as above, and its section on the site (Games or Slots) is its
  `game.json`'s `category`. A folder of maths the manifest does not list fails the checks.
- `shared`, if given, names folders beside the games that their clients share: code, art,
  sound. A client imports from its own game's folder and these; maths imports none of them.
- `hidden: true` keeps the studio from players: the site plays it in its tests, and does not
  show it.

## The game: `game.json`

```json
{
	"slug": "glacier-drop",
	"name": "Glacier Drop",
	"blurb": "Enough of a kind anywhere melts away and more tumbles in.",
	"category": "slots",
	"minStake": 20,
	"modes": [
		{ "id": "spin", "name": "Spin", "costBp": 10000, "table": "spin" },
		{ "id": "thaw", "name": "Buy the Thaw", "costBp": 245000, "table": "thaw" }
	]
}
```

- **Modes** are the ways of opening a round, the ordinary one first: what each costs, as a
  multiple of the bet in basis points (`10000` is one bet), and the table its row is drawn
  from. A cost is one bet at least and a thousand at most.
- **Every mode returns exactly 96.00% of what it costs.** You declare no return and no
  volatility: the weights make the return so, the site's check sums it exactly, and how
  much a game swings is read from its books (of the first mode: a bought bonus is not
  rated). Players are shown one word for it: low, medium or high.
- `minStake` and `maxStake`, in cents, narrow the bets the site takes. The bet times a
  mode's cost must come to whole cents, or the site refuses the bet: a mode at a bet and a
  quarter needs a smallest bet of 0.20.
- **A game pays on the bet, never on what a play cost.** The client opens a round with the
  bet (`host.open(bet, { mode })`, never the cost); the site charges the bet times the
  mode's cost, and pays the bet times what the row pays. A game never divides its wins by
  its costs.

### A choice

A row may end in a `choice`: options that each name a table. The round stays open until the
player picks, and a row is then drawn from that option's table. The client sends
`host.act({ choose: id })`. A choice is counted at its best option, so make the options
worth the same.

### Counters: meters between bets

A game may keep meters for a player from one bet to the next:

```json
"counters": [{ "id": "bronze", "full": 55, "worthBp": 2379, "table": "pour-bronze" }],
"fills": [{ "counters": ["bronze", "silver"], "table": "pour-bronze-silver" }]
```

- A row says what it `adds` to them. A counter that reaches `full` gives `full` back, and a
  row is drawn from its `table`, in the same bet.
- `worthBp` is what one unit is worth, in basis points of the bet. The check counts a row
  that adds a unit as paying that much, and holds the counter's table to what `full` units
  were counted at, so the game returns what it says with the meters in it.
- `fills` name one table for several counters that fill on the same row, in place of each
  one's own.
- Counters are kept **separately for each size of bet**. Otherwise a player fills a meter at
  the smallest bet and collects what it pours at the largest.
- **A bonus as a table of its own.** A counter that fills at one (`"full": 1`) is how a row
  leads to another table with nothing held: a spin that lands the scatters adds one, and
  the bonus is drawn from its own table in that same bet. Use it for a bonus too rare or
  too large to be told well by the few spins of a book that land it, and open the same
  table from a mode to sell it.

## The maths

`maths/index.ts` exports, by default, how each table's rounds play out:

```ts
import { defineBooks, type PlayedRow } from "@keros3ne/studio-sdk/book-play";
import { createRound } from "@keros3ne/studio-sdk/slots";

function spin(rng): PlayedRow {
	const round = createRound();
	const played = spinOnce(rng); // your rules

	round.event("spin", { ...played }); // what the client plays, in order
	round.pay(played.bp); // of the bet, in basis points

	return round.row(); // or round.row({ adds }) or round.row({ choice })
}

export default defineBooks({
	seed: 20261117,
	tables: { spin: { rounds: 300_000, play: spin } }
});
```

- **Written with** `@keros3ne/studio-sdk/book-play` and, for a slot,
  `@keros3ne/studio-sdk/slots`: grids from strips or weights, lines, ways, pays anywhere
  and clusters, falls and free spins with their limits, and a recorder for a round's
  events. Keep the rules themselves in a file of their own (`rules.ts`), which the client
  may read to draw what the events say.
- **Pure.** The maths imports those, `@keros3ne/studio-sdk/rng`, `valibot` and its own
  files, and nothing else. No clock, no network, no randomness of its own: a book must come
  out the same each time it is made. The scan (`scanMaths` in `/testing`) fails any file
  that so much as names `Math.random`, `Date.now`, `new Date`, `fetch`, `process`,
  `crypto`, `performance`, timers, `eval`, `new Function`, `Bun`, `self`, `globalThis`,
  `.constructor`, `postMessage`, `addEventListener` or `import.meta`, in code or in a
  comment.
- **Whole numbers decide.** Use `rng.int` and `rng.shuffle`, not comparisons of floats.
- **Limits.** Any loop that follows the reels (tumbles, cascades, respins) needs a hard
  limit. A row pays a whole number of basis points, from nothing up.
- **Play each table near what it must be worth.** A mode's table must be worth 96% of what
  the mode costs; a counter's, what its units were counted at; a choice's, what you say
  (`worthBp`). The weights make it exact, and the report warns when they had to lean far:
  look at the maths before trusting how such a table feels.
- **Shape.** A table may ask that a group of its rows be drawn once in so many rounds
  (`oneIn`), or make up so much of its worth (`share`): how often a bonus starts, say, held
  to what the guide tells a player.
- **A book holds the rounds that were played to make it and no others.** The rarest outcomes
  a game could have are in it only if one of those rounds landed on them. Play enough
  rounds, and give what is rare a table of its own.

`keros3ne-studio books [slug...]` plays the maths into books, weighs them, runs the site's
check and prints what each table holds. Commit `books/books.json`, the record of them.

A player's bet is checked in their own page: that the row it paid is the one its seeds
draw, against the digests of your books that the site's listing published. There is nothing
of yours to replay.

## The guide

A game's rules, and its paytable if it has one, are shown by the site in the window around
the game: its Rules and Paytable buttons. Write them in `guide.json`, as data (`GameGuide`
in `/guide`): headings, paragraphs (with a bold lead if wanted), lists, and tables of words
and figures. Nothing else: no markup, no pictures, no links. The site checks the guide and
draws it in its own type.

- Hold it to the rules with a test of your own, so that it says what the game does and
  changes when the game does (`multiple(bp)` writes a multiple as "1.50x").
- `rules` is how the game is played and what its features and choices mean; `paytable`,
  left out for a game with nothing to add, is what each symbol or outcome pays.

## The client

The client is static files built into `client/dist`: a page, scripts, styles, art, sound.
The site serves them from a folder of their own and shows the page in a frame inside its own
game window. It is written in Svelte and drawn with Pixi.

    client/index.html          the page: a script, and nothing in its body
    client/src/main.ts         the loading screen, `connect()`, and `mount(Game, ...)`
    client/src/Game.svelte     the game: its stage, its words, its control bar
    client/src/Reels.svelte    a piece on the stage, told what to do
    client/src/*.stories.ts    its stories (below)

**How it is built.** Every client is built the same way, by the SDK (`buildClient` in
`/client-build`), from `client/index.html`, with `client/public` copied as it is: by the
site, by `check` and by `dev`. There is no build configuration of your own: a Vite config is
code, and the site would be running it. The site builds your client with the SDK and nothing
else installed, so a client imports the SDK, Svelte and Pixi (which the SDK brings), its own
game's files and your shared folders, and nothing else: no other package, and nothing from
the network.

**What the sandbox means.** The frame has `sandbox="allow-scripts"`, and the files are served
under a policy that enforces the same even if one is opened directly:

- The page has an origin of its own. It cannot read the site's cookies or storage, or reach
  into the page around it.
- Scripts, styles, images, fonts and audio load only from the client's own folder.
- It can make no requests at all: no `fetch`, no WebSocket. Load sound and art with
  elements, or make them in code.
- No inline scripts.
- The files are public: a sandboxed page's requests carry no cookies, so nothing can check
  who asked.

**Talking to the site.** Use `connect()` from `/client`:

```ts
const host = await connect<View, ProgressView>();
host.init; // balance, stake limits, reducedMotion, a round to resume
await host.open(bet, params); // the bet in cents, never the cost; rejects with a Refusal if the site says no
await host.act(action);
host.settled(); // the result has been shown
host.announce(text); // words for screen-reader users
await host.progress(bet); // the player's progress at a bet
await host.history(); // their latest bets on this game
host.onBalance(listener);
```

The messages themselves are in `/protocol`, marked with the protocol's version. The site
ignores anything not from the game's own frame or not of an agreed shape, and refuses a
client built for another version of the protocol.

**Talking to the site.** Use `connect()` from `/client`:

```ts
const host = await connect<RoundView, Progress>();
host.init; // balance, stake limits, reducedMotion, a round to resume
await host.open(bet, { mode }); // the bet in cents, never the cost; rejects with a Refusal if the site says no
await host.act({ choose }); // a choice, where a round waits at one
host.settled(); // the result has been shown
host.announce(text); // words for screen-reader users
await host.progress(bet); // what the player's counters hold at a bet
await host.history(); // their latest bets on this game
host.onBalance(listener);
```

A round comes back as the rows drawn for it: `round.view.steps`, each with the row's
`events`, and `round.view.options` while the round waits at a choice (`BookView` in
`/book-game`). The messages themselves are in `/protocol`, marked with the protocol's
version. The site ignores anything not from the game's own frame or not of an agreed shape,
and refuses a client built for another version of the protocol.

### The pieces

- **The stage** (`/pixi`): `Stage`, and `Container`, `Sprite`, `Text` and `Graphics` on it,
  each a component whose props say where it is and what it shows. The stage is drawn in the
  game's own measure whatever room it has. With `seeThrough` it has no ground of its own,
  and whatever the page has under it shows through. A helper of your own that draws a shape
  for a `Graphics` takes a `Drawing`, and one that sets words a `TextStyleOptions`, both
  types from the same entry. Pixi is made ready for the frame's policy for you. Name the
  pictures to load in `pictures`: files of the client's own, or pictures written out in the
  address itself (`data:`). They are loaded by an image element, since the policy allows no
  request: do not load them with Pixi's `Assets`.
- **Events** (`/events`, `/emitter`): a round is rows, and a row is events in the order they
  happened. `playEvents` plays them through a handler for each kind, each finished before
  the next begins. A handler does not reach into the pieces: it broadcasts what should
  happen on the game's emitter and waits for the pieces that listen. So a piece knows only
  what it listens for, and can be played by itself in a story.
- **What slots share** (`/slot`): a `Board` of reels that shows a grid, spins to one, lets
  symbols fall when wins are taken away and lights wins with their amounts, and a `Meter`.
  Told something new while it is moving, the board ends what it was doing where that would
  have ended. A fall may hold a piece in place (`held`: its cells, and the picture they
  show), and the rest falls past it. A spin may hold reels back (`holds`). With `instant`,
  nothing moves: pass it when `host.init.reducedMotion` is set.
- **The control bar and controls** (`/controls`): `ControlBar`, and `Menu`, `Choices`,
  `Switch`, `Slider`, `Field`, `Action`, `Popup` and `Autoplay`, as components.
- **The site in a story's place.** Have the game's root take the site as a prop (`host`),
  and a story can hand it something that plays rounds from the books in the site's place.

### What a client must do

1. **Call `settled()` when a result has been shown.** The site learns the result before the
   animation plays, and holds back its own display of the balance, and any card pack that
   dropped, until then. If the game never calls it, the site shows them after 15 seconds.
2. **Be usable without sight or a mouse.** A canvas says nothing to a screen reader and
   cannot be tabbed to. Put real buttons over or beside it, and `announce` what happens.
   The site's accessibility test runs inside the frame.
3. **Honour `reducedMotion`.**
4. **Resume.** If `init.round` is set, the player has a round open, waiting at a choice,
   from this device or another.
5. **Use the control bar.** Every game has the SDK's bar (`ControlBar` in `/controls`), so
   that a player who knows one game knows what everything is in the next. It is five
   segments: the menu, the balance, the bet with buttons to lower and raise it, play with
   autoplay and the speed of play beside it, and the last win. Left alone they are in that
   order and the bar looks as the site's own games' does. What the segments are is the
   site's, and a segment is never broken apart. The rest is yours, through its `layout`:
    - `place`: `bottom`, `top` or `float`; `at`, where a floating bar's middle is, as
      fractions of the game; `scale`, from 0.8 to 1.5.
    - `width`, for a docked bar, a half to all of the game's width (never narrower than what
      is in it), and `align`, `start`, `center` or `end`. `bar.rect()` says where the bar is,
      to put a game's own button on the same row beside it.
    - `order`, the five segments left to right. Play stays in the middle of the bar where
      there is room.
    - `hide`: the menu and the win only. The balance, the bet and play are always shown.
    - `sizes`, each segment 0.8 to 1.25 times the rest: `{ play: 1.2 }`.
    - `arrange`: inside the bet's segment, `split` (minus, the bet, plus) or plus over minus
      in a column at the bet's left or right (`column-start`, `column-end`); inside play's,
      `split` (autoplay at its left, speed at its right), or the two together at one side
      (`row-start`, `row-end`, `column-start`, `column-end`).

    A layout that breaks these throws when the bar is made. How the bar and each segment look
    is the `--bar-*` properties listed at the top of `bar.css`: colours, edges, corners, how
    see-through, and for each segment (`--bar-segment-*`) its own ground, edge, corners and
    padding. `bets` is a list, or the steps the bet buttons move by
    (`{ steps: [{ under: 100, by: 10 }, { by: 100 }] }`: by 0.10 under 1.00, then by 1.00).
    Pressing the bet lets the player type one, any amount inside the game's limits. On a game
    600px wide or narrower the bar is always the site's two rows across the whole width,
    whatever was asked for. Draw clear of it with `bar.inset()`, or with `--sdk-bar-top` and
    `--sdk-bar-bottom` in a style sheet.

    What the bar shows is its props: `balance`, `win`, `busy` while a round is played or
    shown, `autoLeft` as autoplay runs. The bet comes back with `bind:bet`, and `bind:bar`
    hands over the bar itself, for `bar.quick()`, `bar.inset()`, `bar.rect()` and
    `bar.focusPlay()`. More for its menu is written inside it (`{#snippet menu()}`).

    The speed button has three settings: the ordinary pace, fast and turbo. A game with no
    bonus passes `speeds="fast"`; one too quick for speed to matter passes `"none"`. Ask
    `bar.quick(inBonus)` at each step of a play: fast quickens ordinary play only, so pass
    `true` while free spins or a feature are shown, and turbo quickens everything. The speed
    is the player's choice alone: autoplay never changes it.
    - Never draw another bet control, balance or play button of your own.
    - Restyle the bar through the `--bar-*` properties and lay it out through `layout`, and
      nothing else.
    - What a game adds for itself (a button to buy a bonus) goes outside the bar: above it,
      or on its row beside a narrower bar.
    - Autoplay is chosen in Auto's popup (Off, or a number of plays), which only readies it:
      the play button then shows the number over a triangle, and pressing it calls
      `autoplay.onstart(count)`. While the plays run, it shows how many are left over a
      square, and pressing it calls `autoplay.onstop()`; Auto cannot be pressed. Escape over
      the bar puts away plays that are waiting.
    - When the next play costs something other than the bet shown, say what with `cost`.
    - While free spins play, show how many are left on the play button with `freeSpins`, and
      `null` when they are over. The button cannot be pressed meanwhile: free spins are not
      the player's to stop.
    - When the next play is a kind of its own (a boosted spin, a bonus spin), say so over the
      bet with `betLabel`, and `null` for "Bet" again. Name every such kind up front in
      `betLabels`, each at most 10 characters, which are no wider than the amount: the bar
      never changes size. A name not declared throws.
    - A component must not read, while it is being set up, a prop the site may still be
      waiting for. The bar takes its balance once it is in the page.

6. **Use none of the browser's own controls.** `/controls` has replacements, drawn by the
   game, usable from a keyboard and announced properly by a screen reader: `Menu` in place
   of `<select>`, `Popup` for what does not fit in the row of controls, `Switch` in place
   of a checkbox, `Choices` in place of radio buttons, `Action` for a line in a popup that
   does something, `Slider` in place of a range input, and `Field` for a value to type.
   They take their colours from the `--sdk-*` properties. `check` fails a client with a
   `<select>` or a checkbox. **Keep the row of controls the same size**: a button that
   appears only while something is running pushes the others about. Put such things in a
   popup, or make one button change what it does.
7. **Put a button where the thing it does is drawn.** When controls sit over a stage, work
   out their place from the same numbers the drawing uses, not from a second set of sizes
   in CSS.
8. **Show a loading screen while the game gets ready.** Make one with
   `createLoadingScreen()` from `/loading` before anything slow starts, and pass it what
   the game waits for: `loading.track(connect())`, its pictures (the stage's `track`), the
   bar's typeface (`document.fonts.load`). `loading.done()` takes it away. It is only seen
   once loading has taken a moment. Its colours are yours, through the `--loading-*`
   properties.
9. **Show what each win paid, over the reels.** A slot writes the amount of each win where
   it is, not only the total. The `Board` does (`showWins`), choosing a cell of each win so
   that several amounts keep apart; `placeLabels()` in `/ui` is the same choice, for a
   board of your own.
10. **Draw for two shapes.** The site gives a game's frame a fixed shape: 16 by 10 on a
    wider screen and 9 by 16 on a phone, as big as the screen allows, and the same in full
    screen. Lay the game out for both, at any size.

**The card.** Supply the picture for your game's card: `client/public/card.svg`, upright
(three wide by four high), with nothing important in the bottom third, where the site lays
the game's name over it. It is the only picture of the game the site shows. Do not use emoji
for artwork, in the card or the client: they show as empty boxes where no emoji font is
installed.

What stays the site's: the window around the game, its favourite and full-screen buttons,
and the History and Fairness panels under it. Those are how a player checks the game.

## Stories

`keros3ne-studio stories` opens Storybook on your studio: the stories you have written
beside a game's client, and the SDK's own, of the pieces every game shares. The Storybook
is the SDK's, as the client build is: you bring no configuration for it.

- A story is a `*.stories.ts` file under a game's `client/`, in Storybook's usual form: a
  component and the props to show it with (`Meta` and `StoryObj` come from
  `@keros3ne/studio-sdk/stories`). A piece drawn on a stage needs the stage round
  it, so a story's component is usually a small Svelte file of its own (`ReelsStory.svelte`)
  that puts the piece on a `Stage` with a button or two to work it.
- `roundFromBooks()` (`@keros3ne/studio-sdk/stories`) hands a story a round played from the
  game's real books, as the site would play it. Play it through the game's own handlers
  (`playSteps`), and the story shows what a player will see. A round that stops at a choice
  says what may be picked: ask again with the same `seed` and the choice added.
- "Books" among the SDK's stories plays rounds from any of your games' books and lists the
  events of each row, before any of the client is drawn.
- Stories are never built into a client, and are not held to a client's rules: only
  Storybook loads them.

Make a game's books first (`keros3ne-studio books`): a story cannot play from books that
are not there. `keros3ne-studio dev` is still how a game is played whole, by the site's
rules; stories are for one piece, one event or one kind of round at a time.

## The command line

`keros3ne-studio` is `sdk/cli.ts`, run with [Bun](https://bun.sh) in your studio's folder
(or pass `--root <folder>`). The repository's scripts run it:

```sh
bun run books [slug...]     # make a game's books from its maths, and say what they hold
bun run check [slug...]     # the site's checks: books, guide, maths, client
bun sdk/cli.ts dev <slug>   # play it in a browser against a stand-in for the site
bun run stories             # your stories, and the SDK's own, in Storybook
```

- **`books`** plays each table's rounds, on every core, weighs the rows so that each table
  is worth exactly what it must be, runs the site's check, and prints what each table
  holds: how often it pays, its largest win, how its worth is spread, and each mode's
  return and volatility. It fails if the books do not pass.
- **`check`** runs every check of the site's: the manifest, each game's `game.json`, its
  books as they stand (they must be the ones `books.json` records, and pass), its guide,
  its maths' purity, the client's source and the built client (`scanClient`). It builds the
  client first, unless told `--no-build`.
- **`dev`** builds the client whenever it changes and serves it at
  `http://localhost:4190/`, sandboxed under the site's own policy, in a page that stands in
  for the site. It plays the game from its books by the site's own rules, with a pretend
  balance and a pair of seeds: the same stake limits, refusals and rounding of payouts,
  counters kept for each size of bet. It holds the balance back until the game calls
  `settled()`, as the site does, and says so if the game never does. Beside the game it
  shows the balance, what the game announced, the seeds, and every message both ways,
  including those the site would ignore, and why. It switches between the two shapes and
  reduced motion; it starts again when the maths changes, and reloads the game when the
  client is built again. `--port` and `--balance` change where it serves and the balance
  it starts with. It does not do the site's rewards, rate limits, or History and Fairness
  panels.

## Sending a release

1. Run `books`, `check` and your tests, or let CI.
2. Set `sdk` in `studio.json` to the version of the SDK you built on.
3. Commit, tag the release (`git tag v0.1.0`) and push the tag.
4. Run `keros3ne-studio pack`, which checks each game's books and packs them into
   `release/`: one compressed file for each file of each table
   (`harbour-lights.spin.index.gz`). Send them with the tag as the files of its release:
   `gh release create v0.1.0 release/*`. Books are not committed, so this is how they
   travel; the `books/books.json` you did commit is what they are held to.
5. Send KEROS3NE the repository and the tag.

The site takes in your manifest, readme, licence, games and shared folders, and nothing
else of your repository: no build configuration, packages or lockfile. It checks each
game's `game.json` and `guide.json`, which are data, and reads the source of its maths and
client, with none of it run. A person reads your maths in full, and your clients for the
rules. Then the site fetches each game's books from the release, holds them to the record
you committed and runs the whole check on them, builds and checks the client, and lists
the game. **The site never runs your maths**: the books are the game, and the maths is how
you made them, there to be read. A game earns players rewards (xp, rakeback, card packs)
once it is listed: its books are what hold it to its return.

A release replaces your last one, and may not drop a game: past bets on it must stay
verifiable. A change to a game's maths, its manifest or its books changes what past bets on
it are checked against, so once the site has launched, a changed slot is a new game with a
new slug.

## The main entries

| Entry                 | What it is                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `/book-play`          | `defineBooks`, and what a table's maths is written with                 |
| `/slots`              | grids, lines, ways, clusters, falls, free spins, and a round's recorder |
| `/rng`                | the random stream: the site's from a bet's seeds, and the maths' own    |
| `/game-manifest`      | `game.json`'s shape and check                                           |
| `/guide`              | the shape of a game's rules and paytable, and the site's check of one   |
| `/manifest`           | `studio.json`'s shape and check                                         |
| `/book-game`          | a round as the client is sent it (`BookView`), and how a bet is checked |
| `/protocol`           | the messages the client and the site exchange                           |
| `/client`             | `connect()`, the client's side of those messages                        |
| `/pixi`               | the stage, and what is drawn on it                                      |
| `/events`, `/emitter` | playing a round's events in order, and telling the pieces               |
| `/slot`               | the board of reels and the meter                                        |
| `/controls`           | the control bar and the controls, as components                         |
| `/bar`                | the bar as a game is handed it, and the layout a studio may ask for     |
| `/loading`            | the loading screen                                                      |
| `/stories`            | what a story is written with, and rounds from the books for it          |
| `/client-build`       | how every client is built                                               |
| `/testing`            | the site's own checks: the scans of a game's maths and client           |
| `/stand-in`           | a stand-in for the site that plays rounds by its rules, for `dev`       |
| `/*.css`              | the style sheets of the bar, the controls and the loading screen        |

The protocol's version is part of every message, and goes up when a message changes in a
way the other side would misread. The SDK's own version follows semver.

MIT licensed: see `LICENSE`.
