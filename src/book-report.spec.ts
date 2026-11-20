/**
 * The report of a book: that it reads a table's rows rightly, and says so in words when
 * a table's rounds played far from what the table must be worth.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { describe, expect, it } from "vitest";
import {
	formatReport,
	leanOf,
	reportRows,
	reportWarnings,
	type ReportedTable
} from "./book-report.ts";

// Ten rounds: six worth nothing, three worth half a bet, one worth eight and a half.
const values = [0, 5_000, 85_000];
const weights = [6, 3, 1];

describe("a table read", () => {
	const report = reportRows(values, weights);

	it("says what a row is worth, how often it is worth nothing, and the most", () => {
		expect(report.rows).toBe(3);
		expect(report.worthBp).toBe(10_000);
		expect(report.nothing).toBe(0.6);
		expect(report.mostBp).toBe(85_000);
		expect(report.mostOneIn).toBe(10);
	});

	it("spreads the rows worth something into bands, leaving out the empty ones", () => {
		expect(report.bands).toEqual([
			{ from: 0, under: 1, chance: 0.3, share: 0.15 },
			{ from: 5, under: 10, chance: 0.1, share: 0.85 }
		]);
	});

	it("puts a row worth a thousand bets or more in the last band, which has no end", () => {
		const large = reportRows([0, 12_000_000], [999, 1]);

		expect(large.bands).toEqual([{ from: 1_000, chance: 0.001, share: 1 }]);
	});

	it("says what each group asked for came to", () => {
		const grouped = reportRows(values, weights, {
			groups: [{ name: "big", oneIn: 10 }],
			groupOf: [-1, -1, 0]
		});

		expect(grouped.groups).toEqual([{ name: "big", oneIn: 10, share: 0.85 }]);
	});
});

describe("a report written up", () => {
	const table = (playedBp: number): ReportedTable => ({
		table: "spin",
		worthBp: 10_000,
		playedBp,
		report: reportRows(values, weights)
	});
	const modes = [
		{ id: "spin", rtpBp: 9_599.97, volatility: 2.5, maxMultiplierBp: 85_000 }
	];

	it("says how far a table's rounds came from its worth", () => {
		expect(leanOf(table(10_500))).toBeCloseTo(0.05, 9);
		expect(leanOf(table(8_000))).toBeCloseTo(-0.2, 9);
	});

	it("warns of a table whose rounds played far from its worth, and of no other", () => {
		expect(reportWarnings([table(10_500)])).toEqual([]);
		expect(reportWarnings([table(13_000)])).toEqual([
			'"spin" came to 1.30 bets as played, 30.00% over the 1.00 bets it must be worth. The weights make up the difference by drawing its smaller rows more often than they were played: look at the maths before trusting how it feels.'
		]);
		expect(reportWarnings([table(7_000)])[0]).toMatch(
			/30\.00% under .* drawing its larger rows more often/
		);
	});

	it("is every table, then the modes, then what to look at", () => {
		expect(formatReport([table(13_000)], modes).split("\n")).toEqual([
			"spin: 3 rows, worth 1.00 bets (as played 1.30 bets, +30.00%)",
			"  worth something once in 2.5 rounds; the most, 8.50 bets, once in 10.0",
			"  nothing              60.00% of rounds",
			"  under 1 bet          30.00% of rounds   15.00% of worth",
			"  5 to 10 bets         10.00% of rounds   85.00% of worth",
			"",
			"mode spin: returns 95.9997%, volatility 2.50, pays at most 8.50 bets",
			"",
			expect.stringMatching(/^! "spin" came to 1\.30 bets as played/)
		]);
	});
});
