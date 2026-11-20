/**
 * What a book holds, for the studio that made it to read: how often a row is worth
 * anything, how the rows are spread from the small to the large, the most one is worth
 * and how often it comes, and what each group the studio asked for came to. The check
 * (./book-check.ts) says whether a game may be played; this says what it will be like.
 *
 * A row's worth here is what the table counts it at: what it pays, what the units it
 * adds to a counter are counted at, and what the best table it offers must be worth.
 *
 * Pure.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { ShapeGroup } from "./book-weights.ts";

const BP = 10_000;

/** Where each band of worth ends, in bets: a row is in the first it is under. */
const BAND_ENDS = [1, 2, 5, 10, 20, 50, 100, 500, 1_000];

/** How far a table's rounds may come from its worth, as played, before the report says so. */
const LEAN_WORTH_SAYING = 0.1;

/** The rows worth from one figure up to another. */
export interface ReportBand {
	/** In bets. `under` is left out of the last band, which has no end. */
	from: number;
	under?: number;
	/** The share of rounds that draw one of them, and of the table's worth they make up. */
	chance: number;
	share: number;
}

/** A group the studio asked for, as it came out. */
export interface ReportGroup {
	name: string;
	/** One of its rows is drawn once in this many rounds. */
	oneIn: number;
	/** The share of the table's worth it makes up. */
	share: number;
}

export interface TableReport {
	rows: number;
	/** What a row is worth on average, in basis points of the bet. */
	worthBp: number;
	/** The share of rounds that draw a row worth nothing. */
	nothing: number;
	/** The most a row is worth, and once in how many rounds such a row is drawn. */
	mostBp: number;
	mostOneIn: number;
	/** The rows worth something, from the small to the large. Empty bands are left out. */
	bands: ReportBand[];
	groups: ReportGroup[];
}

/**
 * Reads a table from its rows' worths and weights, in the rows' order, with each row's
 * group if the studio asked for a shape (-1 for none).
 */
export function reportRows(
	values: ArrayLike<number>,
	weights: ArrayLike<number>,
	shape?: { groups: readonly ShapeGroup[]; groupOf: ArrayLike<number> }
): TableReport {
	const bandWeight = new Float64Array(BAND_ENDS.length + 1);
	const bandWorth = new Float64Array(BAND_ENDS.length + 1);
	const groupWeight = new Float64Array(shape?.groups.length ?? 0);
	const groupWorth = new Float64Array(shape?.groups.length ?? 0);
	let total = 0;
	let worth = 0;
	let nothing = 0;
	let mostBp = 0;
	let mostWeight = 0;

	for (let row = 0; row < values.length; row++) {
		const value = values[row];
		const weight = weights[row];

		total += weight;
		worth += weight * value;

		if (value > mostBp) {
			mostBp = value;
			mostWeight = 0;
		}
		if (value === mostBp) mostWeight += weight;

		const group = shape ? shape.groupOf[row] : -1;
		if (group >= 0) {
			groupWeight[group] += weight;
			groupWorth[group] += weight * value;
		}

		if (value === 0) {
			nothing += weight;
			continue;
		}

		const found = BAND_ENDS.findIndex((end) => value < end * BP);
		const band = found < 0 ? BAND_ENDS.length : found;

		bandWeight[band] += weight;
		bandWorth[band] += weight * value;
	}

	const bands: ReportBand[] = [];
	for (let band = 0; band <= BAND_ENDS.length; band++) {
		if (bandWeight[band] === 0) continue;

		bands.push({
			from: band === 0 ? 0 : BAND_ENDS[band - 1],
			...(band < BAND_ENDS.length ? { under: BAND_ENDS[band] } : {}),
			chance: bandWeight[band] / total,
			share: bandWorth[band] / worth
		});
	}

	return {
		rows: values.length,
		worthBp: worth / total,
		nothing: nothing / total,
		mostBp,
		mostOneIn: total / mostWeight,
		bands,
		groups: (shape?.groups ?? []).map((group, index) => ({
			name: group.name,
			oneIn: total / groupWeight[index],
			share: groupWorth[index] / worth
		}))
	};
}

/** A table as the report writes it up: what was made of it, and how its rounds played. */
export interface ReportedTable {
	table: string;
	/** What the table had to be worth, and what its rounds came to as they were played. */
	worthBp: number;
	playedBp: number;
	report: TableReport;
}

/** A mode as the check found it. */
export interface ReportedMode {
	id: string;
	rtpBp: number;
	volatility: number;
	maxMultiplierBp: number;
}

/**
 * How far a table's rounds came, as played, from what the table must be worth, as a
 * share of that worth: above nothing if they came to more. The weights make up the
 * difference, by changing how often a win comes.
 */
export const leanOf = (table: Pick<ReportedTable, "worthBp" | "playedBp">): number =>
	table.worthBp === 0 ? 0 : table.playedBp / table.worthBp - 1;

/** What a studio should look at again, in words: tables whose rounds played far from their worth. */
export function reportWarnings(tables: readonly ReportedTable[]): string[] {
	return tables
		.filter((table) => Math.abs(leanOf(table)) > LEAN_WORTH_SAYING)
		.map((table) => {
			const lean = leanOf(table);

			return `"${table.table}" came to ${bets(table.playedBp)} as played, ${percent(Math.abs(lean))} ${lean > 0 ? "over" : "under"} the ${bets(table.worthBp)} it must be worth. The weights make up the difference by drawing its ${lean > 0 ? "smaller" : "larger"} rows more often than they were played: look at the maths before trusting how it feels.`;
		});
}

/** An amount in basis points as bets: 15,000 is "1.50 bets". */
const bets = (bp: number): string => `${(bp / BP).toFixed(bp < 100 * BP ? 2 : 0)} bets`;

/** A share as a percentage: 0.1234 is "12.34%". */
const percent = (share: number): string =>
	`${(share * 100).toFixed(share < 0.0001 ? 4 : 2)}%`;

/** "once in 3.4" for a chance: how many rounds, on average, between one and the next. */
const onceIn = (rounds: number): string =>
	`once in ${rounds < 100 ? rounds.toFixed(1) : Math.round(rounds).toLocaleString("en-US")}`;

/** A whole report as text, for a terminal: every table, then the modes, then what to look at. */
export function formatReport(
	tables: readonly ReportedTable[],
	modes: readonly ReportedMode[]
): string {
	const lines: string[] = [];

	for (const each of tables) {
		const { report } = each;
		const lean = leanOf(each);

		lines.push(
			`${each.table}: ${report.rows.toLocaleString("en-US")} rows, worth ${bets(report.worthBp)} (as played ${bets(each.playedBp)}, ${lean >= 0 ? "+" : "-"}${percent(Math.abs(lean))})`
		);
		lines.push(
			`  worth something ${onceIn(1 / (1 - report.nothing))} rounds; the most, ${bets(report.mostBp)}, ${onceIn(report.mostOneIn)}`
		);
		if (report.nothing > 0)
			lines.push(
				`  ${"nothing".padEnd(18)}${percent(report.nothing).padStart(9)} of rounds`
			);

		for (const band of report.bands) {
			const name =
				band.under === undefined
					? `${band.from} bets and up`
					: band.from === 0
						? `under ${band.under} bet`
						: `${band.from} to ${band.under} bets`;

			lines.push(
				`  ${name.padEnd(18)}${percent(band.chance).padStart(9)} of rounds${percent(band.share).padStart(9)} of worth`
			);
		}

		for (const group of report.groups)
			lines.push(
				`  group "${group.name}": ${onceIn(group.oneIn)} rounds, ${percent(group.share)} of worth`
			);

		lines.push("");
	}

	for (const mode of modes)
		lines.push(
			`mode ${mode.id}: returns ${(mode.rtpBp / 100).toFixed(4)}%, volatility ${mode.volatility.toFixed(2)}, pays at most ${bets(mode.maxMultiplierBp)}`
		);

	const warnings = reportWarnings(tables);
	if (warnings.length > 0) lines.push("", ...warnings.map((warning) => `! ${warning}`));

	return lines.join("\n");
}
