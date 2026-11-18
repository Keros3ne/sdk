/**
 * The control bar: the strip of controls in every studio game, made of the same five
 * segments in all of them, so that a player who has played one game on the site knows
 * what everything is in the next:
 *
 *   menu | balance | - bet + | autoplay play speed | win
 *
 * The bar itself is a Svelte component (./controls/ControlBar.svelte), which a game's
 * client uses as one. This is what a client names of it besides: the bar as the component
 * hands it over (`bind:bar`), the layout a studio may ask for, and the rules a layout is
 * held to (./bar-rules.ts).
 */
import "./ui.css";
import "./bar.css";

export * from "./bar-rules.ts";
