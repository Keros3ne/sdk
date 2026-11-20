/**
 * The control bar and the SDK's controls, as Svelte components: the one way a client has
 * them, so how a bar's items and a control behave is the same in every game. `ControlBar`
 * is the SDK's own bar; `BarFrame`, `BarPart` and the `Bar...` items are what it is made
 * of, for a studio to make a bar of its own from.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

export { default as Action } from "./Action.svelte";
export { default as Autoplay } from "./Autoplay.svelte";
export { default as BarAutoplay } from "./BarAutoplay.svelte";
export { default as BarBalance } from "./BarBalance.svelte";
export { default as BarBet } from "./BarBet.svelte";
export { default as BarBetButton } from "./BarBetButton.svelte";
export { default as BarFrame } from "./BarFrame.svelte";
export { default as BarMenu } from "./BarMenu.svelte";
export { default as BarPart } from "./BarPart.svelte";
export { default as BarPlay } from "./BarPlay.svelte";
export { default as BarSpeed } from "./BarSpeed.svelte";
export { default as BarWin } from "./BarWin.svelte";
export { default as Choices } from "./Choices.svelte";
export { default as ControlBar } from "./ControlBar.svelte";
export { default as Field } from "./Field.svelte";
export { default as Menu } from "./Menu.svelte";
export { default as Popup } from "./Popup.svelte";
export { default as Slider } from "./Slider.svelte";
export { default as Switch } from "./Switch.svelte";
export { BarState, getBar, type BarOptions } from "./bar-state.svelte.ts";
export type { BarLook, ControlLook, SegmentLook } from "../look.ts";
