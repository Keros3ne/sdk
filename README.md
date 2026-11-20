# KEROS3NE studio SDK

Build games for KEROS3NE, a social casino played with play money. This repository is two
things at once:

- **The SDK** (`sdk/`): how a game's outcomes are made into books, the client's bridge to
  the site, the stage, the board, the control bar and controls, Storybook, the site's own
  checks, and the command line. **Its README, [`sdk/README.md`](sdk/README.md), is the
  contract every game is held to.**
- **A studio to start from**: Studio Name, with one game, **Game Title**, a
  three-reel slot kept deliberately simple, so that what it shows is everything a studio
  sends and how, not a game's cleverness.

## Starting a game

A studio keeps its games in as many repositories as it likes, one game to each or a few
together, and each depends on the SDK at a tag. You need [Bun](https://bun.sh).

- **To read, or to try things:** clone this repository. It is a studio's repository as
  well as the SDK's, and everything below runs in it.
- **For a game of your own:** a repository with a `package.json` that depends on the SDK
  (`"@keros3ne/sdk": "github:Keros3ne/sdk#v0.14.0"`), a `studio.json`
  (`{ "sdk": "^0.14.0", "games": ["your-game"] }`), and the game in a folder named by its
  slug, laid out as `game-title/` is. `bun x keros3ne-studio` is the command line the
  scripts below run. What your games share goes in a package of its own (the contract's
  "Sharing between repositories").

## What is here

```
package.json                      the SDK as a package, and the scripts below
sdk/                              the SDK itself (in your own repository, a dependency)
studio.json                       what this repository holds: its games, and the SDK's version
game-title/
  game.json                       the game: its name, blurb, section and modes
  guide.json                      its rules and paytable, as words and tables
  maths/rules.ts                  its rules, as figures and as play
  maths/index.ts                  how its book is made: every way its reels can stop
  maths/maths.spec.ts             its own tests: the rules, the manifest and the guide
  books/books.json                what its book comes to (the book itself is not committed)
  client/src/, public/            what the player sees, in Svelte and Pixi, run sandboxed
  client/src/*.stories.ts         its stories
  client/public/card.svg          its picture on the site's game card
.github/workflows/check.yml       the site's checks, run on every push
```

## Building a game

```sh
bun run books        # make each game's books from its maths, and say what they hold
bun run dev          # play Game Title at http://localhost:4280/ against a stand-in for the site
bun run stories      # the studio's stories, and the SDK's own, in Storybook
bun run check        # the site's checks on each game's books, guide, maths and client
bun run client       # build each game's client, and put what was built on record
bun run pack         # pack each game's books and built client into release/, to send with a tag
bun run test         # the tests: your games' own, and the SDK's
bun run typecheck
```

1. **The site plays a game from its books**, not from your code: for each way of opening a
   round, a table of rows, each with a weight, what it pays and the events that play it
   out. Your maths plays the rounds that make them, and is pure: it draws every random
   choice from the rng it is handed. Every way of playing returns exactly 96.00%: the
   weights are made so. Game Title's book is every one of the 8,000 ways its reels can
   stop, so nothing the game can do is left out.
2. **The client decides nothing.** It asks the site to place a bet through the SDK, plays
   out the events of the row it is given, and calls `settled()` once it has been shown. It
   uses the SDK's stage, board, control bar and controls, draws for a wide frame (16 by 10)
   and a phone's (9 by 16), says what happens for a screen reader, and honours reduced
   motion. It imports the SDK (`@keros3ne/sdk/...`, which is this repository
   itself), Svelte, Pixi, your own files, and whatever other packages you install: you
   build it, so what it is made of is yours to choose.
3. **The guide** is the game's rules and paytable as words and tables, held to the rules'
   own figures by a test.

## Sending a release

1. Run `bun run books`, `bun run client`, `bun run check` and `bun run test`.
2. Set `sdk` in `studio.json` to the version of the SDK you built on.
3. Commit, tag the release (`git tag v0.1.0`) and push the tag.
4. Pack the books and the built client and send them as the release's files: `bun run pack`, then
   `gh release create v0.1.0 release/*`.
5. Send KEROS3NE the repository and the tag.

The site takes in your manifest, readme, licence, games and any folders you list as
`shared`, and nothing else (not `sdk/`); a person reads your maths; then it fetches each
game's books and built client from the release, holds them to the `books/books.json` and
`client/client.json` you committed, checks them and lists the game. It never runs your
maths, and never builds or runs your client's code. A game earns players
rewards once it is listed. A release may not drop a game: past bets on it must stay
verifiable.

The site takes this repository's game in under a studio it keeps hidden: its tests play
Game Title, and players are not shown it.

## Working on the SDK itself

`bun run test` runs the SDK's unit tests and, in a browser, those of its bar and controls;
`bun run test:browser` runs its stage, its board, Storybook and `dev` in a browser. Its
version is in `package.json`, and a release of it is a tag.

### The engine

What plays a game is the engine's (`@keros3ne/engine`, a repository of its own that this
one depends on at a tag): the random stream, the books and their checks, the manifest, the
rules of a bet, and the bet pipeline a site plays every bet by. The SDK gives a studio
those under its own names (`/rng`, `/book-play`, `/bets`, ...), so a studio imports
everything it writes a game with from one package, and `keros3ne-studio dev` plays a game
on the engine's stand-in: the same pipeline, over a store in memory.

To change the two together before either is released, clone the engine beside this
repository and link it: `mkdir -p local && ln -s ../../engine local/engine`. Then
`bun run local <script>` runs any script here on that clone (`bun run local test`,
`bun run local test:browser`, `bun run typecheck:local`). The SDK reaches the engine
through `imports` in `package.json` (`#engine/...`), whose `local` condition names the
clone's files; without it, the same imports are the installed package.

MIT licensed: see `LICENSE`.
