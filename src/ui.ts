/**
 * What the SDK's controls share with the code that uses them. The controls themselves are
 * Svelte components (./controls): `Menu`, in place of `<select>`; `Popup`, a button that
 * opens a small panel of the game's own controls; `Switch`, in place of a checkbox;
 * `Choices`, in place of radio buttons; `Autoplay`; `Slider`, in place of a range input;
 * `Field`, a value to type; and `Action`, a row to press. Import `./ui.css` with them.
 */

/** One option of a `Menu` or of `Choices`: its value, and what it is called. */
export interface MenuOption<Value extends string | number> {
	value: Value;
	label: string;
}

export { placeLabels, type Cell } from "./labels.ts";
