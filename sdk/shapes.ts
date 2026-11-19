/**
 * The two shapes a game is drawn in. The site gives a game's frame one of them, at any
 * size: `wide`, 16 by 10, which every game has; and `tall`, 9 by 16, on a phone, for a
 * game that has a view drawn for it (`shapes` in its `game.json`). A game with no tall
 * view is shown wide on a phone too, across the screen's width.
 *
 * Pure: the site reads it on the server as well as in the browser. What follows a game's
 * shape in the page is ./shape.svelte.ts.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

export const SHAPES = ["wide", "tall"] as const;
export type Shape = (typeof SHAPES)[number];

/** Each shape's width over its height. */
export const SHAPE_RATIO: Record<Shape, number> = { wide: 16 / 10, tall: 9 / 16 };

/** The shape of a game this many pixels wide and high: tall where it is higher than it is wide. */
export function shapeOf(width: number, height: number): Shape {
	return height > width ? "tall" : "wide";
}

/**
 * The shape a game is given where the screen would have this one: the same, if the game
 * has a view for it, and wide otherwise.
 */
export function shapeFor(game: { shapes?: readonly Shape[] }, wanted: Shape): Shape {
	return (game.shapes ?? ["wide"]).includes(wanted) ? wanted : "wide";
}
