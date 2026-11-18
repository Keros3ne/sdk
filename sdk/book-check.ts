/**
 * The check of a game played from books: what the site holds a studio's game to before it
 * is ever played, worked out from its books alone. Nothing here is a simulation. Every row
 * of every table is read once, and what each mode returns is summed exactly, in whole
 * numbers, so the answer is the game's return and not an estimate of it.
 *
 * A game passes when:
 *
 * - every mode opens a table that was shipped, every choice offers tables that were, no
 *   table leads back to itself, and no table was shipped that nothing opens;
 * - no round can take more choices than a round may;
 * - every mode returns `BOOK_RTP_BP` of what it costs: never more, and less by under one
 *   basis point (whole-number weights cannot always land on the figure itself).
 *
 * A row that ends in a choice is counted at what its best option is worth. So the return
 * is the return under the best play, an option may be worth less than another, and none
 * can make a game return more than it says.
 *
 * A game with counters (./game-manifest.ts) is held to the same figure with its meters
 * in it. A row that adds to a counter is counted as paying what those units are worth.
 * The table drawn from when counters fill may never be worth more than the units that
 * filled them were counted at, so a game cannot return more than it says; and where one
 * is worth less, every unit a mode adds is counted again at the worst of them, and the
 * mode must still be within the basis point. Such a table's rows only pay: they add to
 * nothing and end in no choice.
 *
 * How much a mode swings and the most it can pay are read from the same sums, where the
 * old contract had a studio declare them. A meter's swing is in it: a row that adds
 * units fills its counter as often as those units are of what fills it, which is how
 * often it does over a long run, and pays then what the counter's table pays.
 *
 * Pure: it is handed books to go through, and opens no file itself.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { BookRow } from "./book.ts";
import { CHOICE_MAX_DEPTH } from "./book-round.ts";
import { BOOK_RTP_BP, fillsFor, type GameManifest } from "./game-manifest.ts";

const BP = 10_000;
/** How close two options' worths are, as a share, for a player to be as well off with either. */
const SAME_WORTH = 0.0001;

/** What the check needs of a table: what it weighs, and every row in turn. */
export interface ScannableBook {
	totalWeight: number;
	scan(
		visit: (
			record: { weight: number; payoutBp: number },
			row: BookRow,
			number: number
		) => void
	): void;
}

/** What the check found of one mode. */
export interface CheckedMode {
	id: string;
	/** What the mode returns of its cost, in basis points, under the best play. */
	rtpBp: number;
	/** The standard deviation of what a round pays, in what the round costs. */
	volatility: number;
	/** The most a round can pay, as a multiple of the bet in basis points. */
	maxMultiplierBp: number;
}

export interface BooksCheck {
	passed: boolean;
	/** Everything that stood in the way, in words. */
	problems: string[];
	/** Each mode that could be worked out, in the manifest's order. */
	modes: CheckedMode[];
}

/** An exact fraction of whole numbers, kept in lowest terms. */
interface Fraction {
	top: bigint;
	bottom: bigint;
}

/** The greatest whole number that divides both. */
function commonDivisor(first: bigint, second: bigint): bigint {
	while (second !== 0n) [first, second] = [second, first % second];

	return first < 0n ? -first : first;
}

/** A fraction in lowest terms. */
function fraction(top: bigint, bottom: bigint): Fraction {
	const divisor = commonDivisor(top, bottom) || 1n;

	return { top: top / divisor, bottom: bottom / divisor };
}

/** The sum of two fractions. */
const sum = (first: Fraction, second: Fraction): Fraction =>
	fraction(
		first.top * second.bottom + second.top * first.bottom,
		first.bottom * second.bottom
	);

/** Above zero if the first is the greater, below if the second, zero if they are equal. */
function compare(first: Fraction, second: Fraction): number {
	const difference = first.top * second.bottom - second.top * first.bottom;

	return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}

/** A fraction as an ordinary number, good to six places. */
const approximate = (value: Fraction): number =>
	Number((value.top * 1_000_000n) / value.bottom) / 1_000_000;

/** The rows of a table that end in the same choice of tables, added up. */
interface ChoiceRows {
	tables: string[];
	weight: bigint;
	/** Their weights times what they pay themselves on average, before the choice. */
	weightedPay: number;
	/** The most any of them pays itself. */
	mostPay: number;
}

/** One table, added up from its rows. */
interface TableSums {
	weight: bigint;
	/** Every row's weight times what it is counted as paying itself: its payout and its units. */
	weightedPay: bigint;
	/** Every row's weight times what the units it adds are counted at. */
	weightedAdds: bigint;
	/** Every row's weight times what it pays itself on average, fills and all. */
	weightedMoney: number;
	/** Every row's weight times the mean of the square of what it pays itself. */
	weightedSquares: number;
	/** The most a row that ends in no choice pays. */
	mostPlain: number;
	choices: Map<string, ChoiceRows>;
	/** Whether any row adds to a counter. */
	adds: boolean;
}

/** What the sums need to know of a game's counters. */
interface CounterWorth {
	/** What a row's units are counted at, in basis points, or a reason they cannot be. */
	worthOf(adds: Readonly<Record<string, number>>): number | string;
	/** The most the draws for counters these units might fill can pay. */
	mostFrom(adds: Readonly<Record<string, number>>): number;
	/** What those draws pay over a long run: the mean, and the mean of its square. */
	paidFrom(adds: Readonly<Record<string, number>>): { mean: number; square: number };
}

/**
 * Goes through a table once and adds it up. What a row pays itself is its payout and
 * what the units it adds are counted at. `refuse` is told of a row that cannot be counted.
 */
function addUp(
	book: ScannableBook,
	counters: CounterWorth,
	refuse: (reason: string) => void
): TableSums {
	const sums: TableSums = {
		weight: BigInt(book.totalWeight),
		weightedPay: 0n,
		weightedAdds: 0n,
		weightedMoney: 0,
		weightedSquares: 0,
		mostPlain: 0,
		choices: new Map(),
		adds: false
	};

	book.scan((record, row) => {
		const weight = BigInt(record.weight);
		let pays = record.payoutBp;
		let most = record.payoutBp;
		// What it pays in money: on average, and the mean of the square of it.
		let money = record.payoutBp;
		let square = record.payoutBp ** 2;

		if (row.adds) {
			const worth = counters.worthOf(row.adds);
			sums.adds = true;

			if (typeof worth === "string") refuse(worth);
			else {
				const fills = counters.paidFrom(row.adds);

				pays += worth;
				most += counters.mostFrom(row.adds);
				money += fills.mean;
				square += 2 * record.payoutBp * fills.mean + fills.square;
				sums.weightedAdds += weight * BigInt(worth);
			}
		}

		sums.weightedPay += weight * BigInt(pays);
		sums.weightedMoney += record.weight * money;
		sums.weightedSquares += record.weight * square;

		if (!row.choice) {
			sums.mostPlain = Math.max(sums.mostPlain, most);

			return;
		}

		const tables = [...new Set(row.choice.map((option) => option.table))].sort();
		const key = tables.join(" ");
		const rows = sums.choices.get(key) ?? {
			tables,
			weight: 0n,
			weightedPay: 0,
			mostPay: 0
		};

		rows.weight += weight;
		rows.weightedPay += record.weight * money;
		rows.mostPay = Math.max(rows.mostPay, most);
		sums.choices.set(key, rows);
	});

	return sums;
}

/** What a table comes to once the tables its choices offer are known. */
interface Worked {
	/** What a row drawn from it is worth, in basis points of the bet, under the best play. */
	worth: Fraction;
	/** The same with every unit added counted at the worst its counter's tables pay. */
	least: Fraction;
	/** What a round pays from here on average, under the best play, fills and all. */
	mean: number;
	/** The mean of the square of what a round pays from here, under the best play. */
	square: number;
	/** The most a round can pay from here, whatever is picked. */
	most: number;
	/** The most choices a round can take from here. */
	depth: number;
}

/**
 * Checks a game: its manifest against its books, by table name. `problems` says in
 * words everything that stood in the way, and `modes` what each mode comes to.
 */
export function checkBooks(
	game: GameManifest,
	books: Readonly<Record<string, ScannableBook>>
): BooksCheck {
	const problems = new Set<string>();
	const sums = new Map<string, TableSums>();
	const worked = new Map<string, Worked | null>();
	const reached = new Set<string>();
	const defined = game.counters ?? [];
	/** The most any table that counters fill from falls short of what it was counted at. */
	let shortfall = fraction(0n, 1n);
	const paid = new Map<string, { mean: number; square: number }>();

	/** The most a row drawn from a fill's table pays, once that table is worked out. */
	const mostOf = (table: string) => worked.get(table)?.most ?? 0;

	const counters: CounterWorth = {
		worthOf(adds) {
			let worth = 0;

			for (const [id, units] of Object.entries(adds)) {
				const counter = defined.find((each) => each.id === id);
				if (!counter) return `adds to a counter "${id}" the game does not have`;

				if (units > counter.full)
					return `adds ${units} to the counter "${id}" at once, more than fills it`;

				worth += units * counter.worthBp;
			}

			return worth;
		},

		// Any of the counters a row adds to may be the ones it fills: the most over them all.
		mostFrom(adds) {
			const ids = Object.keys(adds);
			let most = 0;

			for (let chosen = 1; chosen < 2 ** ids.length; chosen++) {
				const filled = ids.filter((_, index) => (chosen >> index) % 2 === 1);
				const pays = fillsFor(game, filled).reduce(
					(total, owed) => total + mostOf(owed.table),
					0
				);

				most = Math.max(most, pays);
			}

			return most;
		},

		// Over a long run a counter is as likely to be found at any level as another, so a
		// row that adds some of what fills it fills it that share of the time, and each
		// counter apart from the others.
		paidFrom(adds) {
			const key = JSON.stringify(adds);
			const known = paid.get(key);
			if (known) return known;

			const ids = Object.keys(adds);
			const share = (id: string) =>
				adds[id] / defined.find((each) => each.id === id)!.full;
			const result = { mean: 0, square: 0 };

			for (let chosen = 1; chosen < 2 ** ids.length; chosen++) {
				const isFilled = (index: number) => (chosen >> index) % 2 === 1;
				const chance = ids.reduce(
					(product, id, index) =>
						product * (isFilled(index) ? share(id) : 1 - share(id)),
					1
				);

				// The draws owed are apart from one another: their means and spreads add.
				let mean = 0;
				let spread = 0;
				for (const owed of fillsFor(
					game,
					ids.filter((_, index) => isFilled(index))
				)) {
					const fill = worked.get(owed.table);

					mean += fill?.mean ?? 0;
					spread += fill ? fill.square - fill.mean ** 2 : 0;
				}

				result.mean += chance * mean;
				result.square += chance * (spread + mean ** 2);
			}

			paid.set(key, result);

			return result;
		}
	};

	/**
	 * Works a table out, and first every table its choices offer. `path` is the tables
	 * that led here, to find one that leads back to itself. `null` if it cannot be.
	 */
	function work(table: string, path: readonly string[]): Worked | null {
		reached.add(table);

		const known = worked.get(table);
		if (known !== undefined) return known;

		if (path.includes(table)) {
			const loop = [...path.slice(path.indexOf(table)), table].join(", ");
			problems.add(
				`the table "${table}" leads back to itself through its choices (${loop})`
			);

			return null;
		}

		const book = books[table];
		if (!book) return null;

		const tableSums =
			sums.get(table) ??
			addUp(book, counters, (reason) =>
				problems.add(`the table "${table}" ${reason}`)
			);
		sums.set(table, tableSums);

		let worth = fraction(tableSums.weightedPay, 1n);
		let least = sum(
			worth,
			fraction(-tableSums.weightedAdds * shortfall.top, shortfall.bottom)
		);
		let money = tableSums.weightedMoney;
		let squares = tableSums.weightedSquares;
		let most = tableSums.mostPlain;
		let depth = 0;
		let whole = true;

		for (const rows of tableSums.choices.values()) {
			let best: Worked | null = null;
			let mostOffered = 0;
			const options: Worked[] = [];

			for (const offered of rows.tables) {
				const option = work(offered, [...path, table]);

				if (!option) {
					if (!books[offered])
						problems.add(
							`the table "${table}" offers a choice of the table "${offered}", which has no book`
						);
					whole = false;
					continue;
				}

				// The best option is worth the most, exactly.
				if (!best || compare(option.worth, best.worth) > 0) best = option;

				options.push(option);

				mostOffered = Math.max(mostOffered, option.most);
				depth = Math.max(depth, option.depth + 1);
			}

			if (!best) continue;

			const weight = Number(rows.weight);

			// How much the choice swings is rated on the option that swings most among
			// those as good as the best. Options meant to be worth the same come out a
			// hair apart once weighed, so as good means within a part in ten thousand.
			const asGood = approximate(best.worth) * (1 - SAME_WORTH);
			let rated = best;
			for (const option of options) {
				const swings = option.square - option.mean ** 2;

				if (
					approximate(option.worth) >= asGood &&
					swings > rated.square - rated.mean ** 2
				)
					rated = option;
			}

			worth = sum(worth, fraction(rows.weight * best.worth.top, best.worth.bottom));
			least = sum(least, fraction(rows.weight * best.least.top, best.least.bottom));
			money += weight * rated.mean;
			squares += 2 * rows.weightedPay * rated.mean + weight * rated.square;
			most = Math.max(most, rows.mostPay + mostOffered);
		}

		const result = whole
			? {
					worth: fraction(worth.top, worth.bottom * tableSums.weight),
					least: fraction(least.top, least.bottom * tableSums.weight),
					mean: money / Number(tableSums.weight),
					square: squares / Number(tableSums.weight),
					most,
					depth
				}
			: null;
		worked.set(table, result);

		return result;
	}

	// The tables drawn from when counters fill come first: what a row that adds to a
	// counter can pay depends on them. None may be worth more than its units were counted at.
	const fills = [
		...defined.map((each) => ({
			what: `the counter "${each.id}"`,
			table: each.table,
			counted: each.full * each.worthBp
		})),
		...(game.fills ?? []).map((each) => ({
			what: `the counters ${each.counters.map((id) => `"${id}"`).join(" and ")} together`,
			table: each.table,
			counted: each.counters.reduce((total, id) => {
				const counter = defined.find((one) => one.id === id)!;

				return total + counter.full * counter.worthBp;
			}, 0)
		}))
	];

	for (const { what, table, counted } of fills) {
		if (!books[table]) {
			problems.add(`${what} fills from the table "${table}", which has no book`);
			continue;
		}

		const fill = work(table, []);
		const tableSums = sums.get(table);
		if (tableSums && (tableSums.adds || tableSums.choices.size > 0))
			problems.add(
				`the table "${table}" is drawn from when ${what} fills, so its rows may only pay: none may add to a counter or end in a choice`
			);

		if (!fill) continue;

		const figure = `${approximate(fill.worth).toFixed(2)} basis points`;
		const whole = fraction(BigInt(counted), 1n);

		if (compare(fill.worth, whole) > 0)
			problems.add(
				`the table "${table}" is worth ${figure}, more than the ${counted} that filling ${what} was counted at`
			);

		// What it falls short by, as a share of what was counted: the modes answer for the worst.
		const short = fraction(
			whole.top * fill.worth.bottom - fill.worth.top,
			whole.top * fill.worth.bottom
		);
		if (compare(short, shortfall) > 0) shortfall = short;
	}

	const modes: CheckedMode[] = [];

	for (const mode of game.modes) {
		if (!books[mode.table]) {
			problems.add(
				`the mode "${mode.id}" opens the table "${mode.table}", which has no book`
			);
			continue;
		}

		const table = work(mode.table, []);
		if (!table) continue;

		if (table.depth > CHOICE_MAX_DEPTH)
			problems.add(
				`a round of the mode "${mode.id}" can take ${table.depth} choices, and a round takes at most ${CHOICE_MAX_DEPTH}`
			);

		// What it returns of its cost, held between the figure and a basis point under it.
		const cost = BigInt(mode.costBp);
		const returned = fraction(
			table.worth.top * BigInt(BP),
			table.worth.bottom * cost
		);
		const rtpBp = approximate(returned);
		const percent = `${(rtpBp / 100).toFixed(4)}%`;
		const target = `${(BOOK_RTP_BP / 100).toFixed(2)}%`;

		if (compare(returned, fraction(BigInt(BOOK_RTP_BP), 1n)) > 0)
			problems.add(`the mode "${mode.id}" returns ${percent}, over ${target}`);

		// Held to the basis point with every unit counted at the worst its tables pay.
		const atLeast = fraction(table.least.top * BigInt(BP), table.least.bottom * cost);
		if (compare(atLeast, fraction(BigInt(BOOK_RTP_BP - 1), 1n)) <= 0)
			problems.add(
				compare(table.least, table.worth) === 0
					? `the mode "${mode.id}" returns ${percent}, a basis point or more under ${target}`
					: `the mode "${mode.id}" returns as little as ${(approximate(atLeast) / 100).toFixed(4)}% with its counters counted at what their tables pay, a basis point or more under ${target}`
			);

		modes.push({
			id: mode.id,
			rtpBp,
			volatility:
				Math.sqrt(Math.max(0, table.square - table.mean ** 2)) / mode.costBp,
			maxMultiplierBp: table.most
		});
	}

	for (const table of Object.keys(books))
		if (!reached.has(table))
			problems.add(
				`the table "${table}" is opened by no mode and offered by no choice`
			);

	return { passed: problems.size === 0, problems: [...problems], modes };
}
