/**
 * The weights of a book: how often each row of a table is drawn. A studio's maths plays a
 * table's rounds out and each comes to a row; this gives the rows the whole-number weights
 * that make the table worth exactly what it must be, which playing them out never quite is.
 *
 * It changes as little as it can. Rows worth less than the table must come to are all
 * weighed alike, and so are the rows worth as much or more; the two weights are the only
 * pair that makes the table worth its target. A table already close to it is barely
 * changed, and what a win looks like when it comes is not changed at all.
 *
 * A studio may ask for more with a shape: named groups of rows, each drawn once in so
 * many rounds, or making up a set share of what the table is worth. Rows in no such
 * group take up what is left, as above.
 *
 * The answer is exact, not close: the weights are whole numbers, and the table's worth is
 * added up in whole numbers and held at or under its target, by less than a hundred
 * thousandth of it. The site's own check (./book-check.ts) is the judge, and agrees.
 *
 * Pure.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

/** What every table's weights come to, about: enough that the rarest row weighs plenty. */
const SCALE = 2 ** 48;
/** How far under its target a table is aimed, as a share, so that rounding cannot put it over. */
const AIM_UNDER = 3e-6;
/** How far under its target a table may end, as a share of it. */
const MOST_UNDER = 100_000n;

/** A group of rows a studio asks something of. Give one of `oneIn` and `share`. */
export interface ShapeGroup {
	name: string;
	/** A row of the group is drawn once in this many rounds. */
	oneIn?: number;
	/** The group makes up this share, from 0 to 1, of what the table is worth. */
	share?: number;
}

/** What a studio asks of a table beyond its worth. */
export interface Shape {
	groups: readonly ShapeGroup[];
	/** For each row, its group's place in `groups`, or -1 for none. */
	groupOf: ArrayLike<number>;
}

/**
 * The weights that make rows worth `values` (in basis points of the bet, whole numbers)
 * into a table worth `targetBp`, in the rows' order. Throws, in words a studio can act
 * on, when no weights can: a target outside what the rows pay, or a shape that asks for
 * more than there is.
 */
export function weighRows(
	values: ArrayLike<number>,
	targetBp: number,
	shape?: Shape
): Float64Array {
	const rows = values.length;
	if (rows === 0) throw new Error("There are no rows to weigh.");

	if (!Number.isSafeInteger(targetBp) || targetBp < 0)
		throw new Error(
			`A table is worth a whole number of basis points, not ${targetBp}.`
		);

	// How likely each row is to be drawn, before the likelihoods are made whole numbers.
	const chances = new Float64Array(rows);
	const aim = targetBp * (1 - AIM_UNDER);
	let chanceLeft = 1;
	let worthLeft = aim;

	// The groups asked for first: each takes its share of the draws or of the worth.
	const groups = shape?.groups ?? [];
	const counts = new Float64Array(groups.length);
	const sums = new Float64Array(groups.length);

	for (let row = 0; row < rows; row++) {
		const value = values[row];
		if (!Number.isSafeInteger(value) || value < 0)
			throw new Error(
				`Row ${row} is worth ${value}, not a whole number of basis points.`
			);

		const group = shape ? shape.groupOf[row] : -1;
		if (group < 0) continue;

		counts[group] += 1;
		sums[group] += value;
	}

	const groupChance = groups.map((group, index) => {
		if (counts[index] === 0)
			throw new Error(`The group "${group.name}" has no rows.`);

		const mean = sums[index] / counts[index];
		if ((group.oneIn === undefined) === (group.share === undefined))
			throw new Error(`The group "${group.name}" is given one of oneIn and share.`);

		if (group.share !== undefined && mean === 0)
			throw new Error(
				`The group "${group.name}" pays nothing, so it has no share.`
			);

		const chance =
			group.oneIn !== undefined ? 1 / group.oneIn : (group.share! * aim) / mean;
		if (!(chance > 0 && chance < 1))
			throw new Error(`The group "${group.name}" cannot be drawn that often.`);

		chanceLeft -= chance;
		worthLeft -= chance * mean;

		return chance / counts[index];
	});

	if (chanceLeft <= 0 || worthLeft < 0)
		throw new Error("The groups ask for more than the table has to give.");

	// The rest: rows under what they must come to on average, and rows at or over it.
	const needed = worthLeft / chanceLeft;
	let lowCount = 0;
	let lowSum = 0;
	let highCount = 0;
	let highSum = 0;

	for (let row = 0; row < rows; row++) {
		if (shape && shape.groupOf[row] >= 0) continue;

		if (values[row] < needed) {
			lowCount += 1;
			lowSum += values[row];
		} else {
			highCount += 1;
			highSum += values[row];
		}
	}

	let lowChance = 0;
	let highChance = 0;

	if (lowCount + highCount === 0) {
		if (Math.abs(worthLeft) > aim * 1e-9 || chanceLeft > 1e-9)
			throw new Error("The groups leave rounds over, and no rows to draw in them.");
	} else if (highCount === 0) {
		throw new Error(
			`No row is worth the ${needed.toFixed(0)} basis points the rows must come to on average: the most is ${lowSum > 0 ? "under it" : "nothing"}.`
		);
	} else if (lowCount === 0) {
		// The aim is a hair under the target, so rows worth the target itself are let by.
		if (highSum > needed * highCount * (1 + 2 * AIM_UNDER))
			throw new Error(
				`Every row is worth the ${needed.toFixed(0)} basis points the rows must come to on average, or more: none is under it.`
			);

		highChance = chanceLeft / highCount;
	} else {
		// Two unknowns, two sums: the draws left over, and the worth left over.
		const determinant = lowCount * highSum - highCount * lowSum;

		lowChance = (chanceLeft * highSum - worthLeft * highCount) / determinant;
		highChance = (worthLeft * lowCount - chanceLeft * lowSum) / determinant;
	}

	for (let row = 0; row < rows; row++) {
		const group = shape ? shape.groupOf[row] : -1;

		chances[row] =
			group >= 0
				? groupChance[group]
				: values[row] < needed
					? lowChance
					: highChance;
	}

	return wholeWeights(values, chances, targetBp);
}

/**
 * Whole-number weights in proportion to the rows' chances, with the table held exactly at
 * or under its target. Rounding a weight moves the table by a hair either way; if that
 * leaves it over, every row worth less than the target is drawn a little more often,
 * all alike, until it is not.
 */
function wholeWeights(
	values: ArrayLike<number>,
	chances: Float64Array,
	targetBp: number
): Float64Array {
	const rows = values.length;
	const weights = new Float64Array(rows);
	const target = BigInt(targetBp);
	// What the weights come to, and by how much their worth is over the target's.
	let total = 0n;
	let over = 0n;
	let under = 0;
	let underBy = 0n;

	for (let row = 0; row < rows; row++) {
		const weight = Math.max(1, Math.round(chances[row] * SCALE));
		const value = BigInt(values[row]);

		weights[row] = weight;
		total += BigInt(weight);
		over += BigInt(weight) * (value - target);

		if (value < target) {
			under += 1;
			underBy += target - value;
		}
	}

	if (over > 0n) {
		if (under === 0) throw new Error("No row is worth less than the table must be.");

		// Each step on every such row takes `underBy` off what the table is over by.
		const steps = Number((over + underBy - 1n) / underBy);

		for (let row = 0; row < rows; row++)
			if (values[row] < targetBp) weights[row] += steps;

		total += BigInt(steps) * BigInt(under);
		over -= BigInt(steps) * underBy;
	}

	if (-over * MOST_UNDER > target * total)
		throw new Error(
			"The rows cannot be weighed closely enough: the table ends too far under what it must be worth."
		);

	return weights;
}

/** What a table is worth with these weights, in basis points: for a report, not a check. */
export function worthOf(values: ArrayLike<number>, weights: ArrayLike<number>): number {
	let total = 0;
	let worth = 0;

	for (let row = 0; row < values.length; row++) {
		total += weights[row];
		worth += weights[row] * values[row];
	}

	return worth / total;
}
