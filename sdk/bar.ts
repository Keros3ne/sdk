/**
 * The control bar: the controls every studio game is played with, the same items in all
 * of them, so that a player who has played one game on the site knows what everything is
 * in the next: the menu, the balance, the bet, play, autoplay, the speed and the last win.
 *
 * The bar itself is Svelte components (./controls): `ControlBar`, the SDK's own, and the
 * frame and items it is made of, for a studio's own. This is what a client names of it
 * besides: the bar as a frame hands it over (`bind:bar`), its items' names, and the rules
 * a bar is held to (./bar-rules.ts).
 */
import "./ui.css";
import "./bar.css";

export * from "./bar-rules.ts";
