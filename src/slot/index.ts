/**
 * What slots share on the stage: a board of reels that spins, tumbles and lights its
 * wins, and a meter. They are drawn with the SDK's Pixi bindings (../pixi) and are told
 * what to do from a round's events (../events.ts); they decide nothing.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

export { default as Board } from "./Board.svelte";
export type { LitWin, Pace } from "./board.ts";
export { default as Meter } from "./Meter.svelte";
export {
	createTweens,
	easeOut,
	steady,
	type TweenOptions,
	type Tweens
} from "./tween.ts";
