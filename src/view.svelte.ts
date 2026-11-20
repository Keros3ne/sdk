/**
 * A game's view, as what is drawn in it may ask of it: how much it is scaled. A view is
 * drawn at one size (`VIEW_SIZE`) and scaled as a whole to the room the game has, so what
 * is in it is written in the view's own pixels and never asks how big the screen is. One
 * thing does need the scale: a canvas, which must be drawn with as many dots as it is
 * shown with, or it is soft (./pixi/Stage.svelte reads it for that).
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import { createContext } from "svelte";
import type { Shape } from "./shapes.ts";

/** A view, for what is drawn in it. */
export interface ViewScale {
	/** Which of the game's two views this is. */
	readonly shape: Shape;
	/** How many of the screen's pixels one of the view's is drawn with. */
	readonly scale: number;
}

const [getContext, setContext] = createContext<ViewScale>();

/** Called by a view, once, as it is set up. */
export const provideView = (view: ViewScale): ViewScale => setContext(view);

/** The view this is drawn in, or `undefined` outside one (a component shown by itself in a story). */
export function getView(): ViewScale | undefined {
	try {
		return getContext();
	} catch {
		return undefined;
	}
}
