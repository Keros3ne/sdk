/**
 * Where to write what each win paid, over the reels.
 *
 * Several wins at once tend to share cells or sit side by side: lines cross in
 * the middle reels, and symbols that pay anywhere are scattered over each
 * other. Writing each amount at the middle of its win piles the amounts up.
 * Instead each amount goes on one of its own win's cells, and the cells are
 * chosen to be as far from each other as they can be.
 *
 * Pure, and used by the built-in slot machine and, through the SDK, by studio
 * games.
 */
export type Cell = readonly [reel: number, row: number];

/**
 * A label is wide and short, so two on the same row crowd each other sooner
 * than two in the same reel. Sideways distance therefore counts for less.
 */
const distance = (a: Cell, b: Cell) => Math.hypot((a[0] - b[0]) * 0.6, a[1] - b[1]);

/**
 * One cell for each win, in the order given, chosen from that win's own cells.
 * Wins with the fewest cells choose first, since they have the least room to
 * move. The first takes the cell nearest its own middle; each one after takes
 * the cell furthest from those already taken.
 */
export function placeLabels(wins: readonly (readonly Cell[])[]): Cell[] {
	const placed: (Cell | undefined)[] = wins.map(() => undefined);
	const taken: Cell[] = [];
	const order = wins
		.map((_cells, index) => index)
		.sort((a, b) => wins[a].length - wins[b].length || a - b);

	for (const index of order) {
		const cells = wins[index];
		if (cells.length === 0) continue;
		const middle: Cell = [
			cells.reduce((sum, cell) => sum + cell[0], 0) / cells.length,
			cells.reduce((sum, cell) => sum + cell[1], 0) / cells.length
		];
		let best = cells[0];
		let bestRoom = -1;
		let bestOff = Infinity;
		for (const cell of cells) {
			// How much room this cell has from every label already placed.
			const room = taken.length
				? Math.min(...taken.map((other) => distance(cell, other)))
				: 0;
			const off = distance(cell, middle);
			if (
				room > bestRoom + 1e-9 ||
				(Math.abs(room - bestRoom) <= 1e-9 && off < bestOff)
			) {
				best = cell;
				bestRoom = room;
				bestOff = off;
			}
		}
		placed[index] = best;
		taken.push(best);
	}
	return placed.map((cell, index) => cell ?? wins[index][0] ?? [0, 0]);
}
