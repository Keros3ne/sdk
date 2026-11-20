/**
 * A game's views: `WideView` and `TallView`, which a studio draws its game in, and `Views`,
 * which shows whichever the game is told to (the engine's: it is not the game's to decide).
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
export { default as Views } from "#engine/Views.svelte";
export { default as WideView } from "./WideView.svelte";
export { default as TallView } from "./TallView.svelte";
export { getView, type ViewScale } from "./view.svelte.ts";
export { SHAPES, SHAPE_RATIO, VIEW_SIZE, type Shape } from "./shapes.ts";
