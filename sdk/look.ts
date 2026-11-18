/**
 * How a studio makes the SDK's control bar and controls its game's own: the `look` each
 * component takes as a prop, and the properties their style sheets read that carry it
 * (./bar.css, ./ui.css). Everything left out stays as the site draws it.
 *
 * A look changes how a thing is dressed, never what it is: the bar's segments, where a
 * popup opens and what a player needs to see are not in it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import type { BarSegment } from "./bar-rules.ts";

/** How one of the SDK's controls looks: a menu, a popup, a switch, choices, a slider, a field. */
export interface ControlLook {
	/** Text and symbols. */
	ink?: string;
	/** Small labels. */
	dim?: string;
	/** What popups, lists and buttons are drawn on. */
	surface?: string;
	/** Hairlines. */
	line?: string;
	/** Focus, and what is chosen or switched on. */
	accent?: string;
	/** What is drawn on the accent. */
	onAccent?: string;
	/** The one main action in a popup, and a slider's fill. */
	main?: string;
	/** What is drawn on the main action. */
	onMain?: string;
	/** The corners of buttons and choices, as `border-radius` takes them: `"4px"`, `"999px"`. */
	radius?: string;
}

/** How one segment of the control bar looks: drawn with nothing round it unless asked. */
export interface SegmentLook {
	/** What it is drawn on. */
	surface?: string;
	/** Its edge, as a `border`: `"1px solid #fff4"`. */
	border?: string;
	/** Its corners. */
	radius?: string;
	/** The room inside its edge. */
	padding?: string;
	/** A shadow under it. */
	shadow?: string;
	/** A `backdrop-filter` for a see-through segment: `"blur(6px)"`. */
	blur?: string;
}

/** How the control bar looks. */
export interface BarLook {
	/** What the bar is drawn on. May be see-through. */
	surface?: string;
	/** What its popups are drawn on. */
	popup?: string;
	/** The hairline between the bar and the game. `"transparent"` for none. */
	rule?: string;
	/** Its text and symbols. */
	ink?: string;
	/** Its small labels. */
	dim?: string;
	/** The edge of its buttons. */
	line?: string;
	/** The edge of a button under the pointer. */
	lineStrong?: string;
	/** What its buttons are drawn on. */
	button?: string;
	/** The corners of its buttons. `"50%"` makes them circles. */
	buttonRadius?: string;
	/** The play button, and whatever is switched on. */
	accent?: string;
	/** The symbol on the play button. */
	onAccent?: string;
	/** Its typeface. */
	font?: string;
	/** Its small labels' typeface. */
	labelFont?: string;
	/** The line round a floating bar. */
	edge?: string;
	/** The corners of a floating bar. */
	radius?: string;
	/** The shadow under a floating bar. */
	shadow?: string;
	/** A `backdrop-filter` for a see-through bar: `"blur(8px)"`. */
	blur?: string;
	/** The room between segments. */
	gap?: string;
	/** Every segment's look. */
	segment?: SegmentLook;
	/** One segment's look, over what `segment` says: `{ play: { radius: "16px" } }`. */
	segments?: Partial<Record<BarSegment, SegmentLook>>;
}

/** A property and the value to give it. */
export type Dressing = [name: string, value: string];

/** What a part of a look is called as a property: `lineStrong` is `line-strong`. */
const dashed = (part: string) =>
	part.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * The parts of a look as properties, each named `prefix` and its own name. Throws on a
 * value that would say more than its own property.
 */
function properties(look: object | undefined, prefix: string): Dressing[] {
	const set: Dressing[] = [];

	for (const [part, value] of Object.entries(look ?? {})) {
		if (value === undefined || typeof value === "object") continue;

		const written = String(value);
		if (/[;{}]/.test(written)) {
			throw new Error(`A look's "${part}" cannot be ${JSON.stringify(value)}.`);
		}

		set.push([`${prefix}${dashed(part)}`, written]);
	}

	return set;
}

/** A control's look as the properties its style sheet reads (./ui.css). */
export function controlProperties(look: ControlLook | undefined): Dressing[] {
	return properties(look, "--sdk-");
}

/** One segment's look as the properties the bar's style sheet reads. */
export function segmentProperties(look: SegmentLook | undefined): Dressing[] {
	return properties(look, "--bar-segment-");
}

/** The bar's look, short of single segments', as the properties its style sheet reads (./bar.css). */
export function barProperties(look: BarLook | undefined): Dressing[] {
	return [...properties(look, "--bar-"), ...segmentProperties(look?.segment)];
}

/**
 * Dresses an element: an attachment that sets the properties on it, and takes them off
 * again when they change or the element goes. `dressing` is read each time, so a look
 * that changes is followed.
 */
export function dress(dressing: () => Dressing[]): (element: HTMLElement) => () => void {
	return (element) => {
		const set = dressing();
		for (const [name, value] of set) element.style.setProperty(name, value);

		return () => {
			for (const [name] of set) element.style.removeProperty(name);
		};
	};
}
