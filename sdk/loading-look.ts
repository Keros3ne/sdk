/**
 * How a studio makes the loading screen its game's own: what `createLoadingScreen()` is
 * told (./loading.ts), as the properties the screen's style sheet reads (./loading.css).
 *
 * Pure, and shared by the two that draw the screen: the game's code, once it runs, and the
 * build, which reads the same words out of the game's source and writes the screen into
 * the page before any of that code has arrived (./client-build.ts).
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

/** How the loading screen looks. Everything left out stays as the site draws it. */
export interface LoadingLook {
	/**
	 * What it is drawn on: a colour, a gradient, anything `background` takes. The game's
	 * own ground, so that when the screen leaves only what is in front changes.
	 */
	surface?: string;
	/** The colour of the game's name. */
	ink?: string;
	/** The name's typeface, as `font-family` takes it. */
	font?: string;
	/** The name's size, in pixels. */
	titleSize?: number;
	/** The name's weight: 400 to 900. */
	titleWeight?: number;
	/** The room between the name's letters, as `letter-spacing` takes it: `"0.16em"`. */
	titleSpacing?: string;
	/** The name's case. */
	titleCase?: "none" | "uppercase" | "lowercase" | "capitalize";
	/** False to leave the name out, where the logo says it. */
	showTitle?: boolean;
	/** The empty part of the bar. */
	track?: string;
	/** The filled part of the bar: a colour or a gradient. */
	fill?: string;
	/** The bar's width, in pixels. Never over 60% of the game's. */
	barWidth?: number;
	/** The bar's height, in pixels. */
	barHeight?: number;
	/** The bar's corners, in pixels. */
	barRadius?: number;
	/** The logo's width, in pixels. Never over half the game's. */
	logoWidth?: number;
	/** The most the logo may be tall, in pixels. */
	logoHeight?: number;
	/** The room between the logo, the name and the bar, in pixels. */
	gap?: number;
}

/** Each part of a look, by the property that carries it, and whether it is a measure in pixels. */
const PROPERTIES: Record<keyof LoadingLook, { name: string; pixels?: true }> = {
	surface: { name: "--loading-surface" },
	ink: { name: "--loading-ink" },
	font: { name: "--loading-font" },
	titleSize: { name: "--loading-title-size", pixels: true },
	titleWeight: { name: "--loading-title-weight" },
	titleSpacing: { name: "--loading-title-spacing" },
	titleCase: { name: "--loading-title-case" },
	showTitle: { name: "--loading-title" },
	track: { name: "--loading-track" },
	fill: { name: "--loading-fill" },
	barWidth: { name: "--loading-bar-width", pixels: true },
	barHeight: { name: "--loading-bar-height", pixels: true },
	barRadius: { name: "--loading-bar-radius", pixels: true },
	logoWidth: { name: "--loading-logo-width", pixels: true },
	logoHeight: { name: "--loading-logo-height", pixels: true },
	gap: { name: "--loading-gap", pixels: true }
};

/**
 * A look as the properties to set on the screen, each with its value. Throws on a part
 * that is not one of a look's, or a value that would say more than its own property: a
 * look changes how the screen is dressed, never where it is or what it covers.
 */
export function lookProperties(look: LoadingLook): [name: string, value: string][] {
	const set: [string, string][] = [];

	for (const [part, value] of Object.entries(look)) {
		const property = PROPERTIES[part as keyof LoadingLook];
		if (!property) throw new Error(`The loading screen has no "${part}" to set.`);
		if (value === undefined) continue;

		if (part === "showTitle") {
			if (value === false) set.push([property.name, "none"]);
			continue;
		}

		const written = property.pixels ? `${Number(value)}px` : String(value);
		if (
			/[;{}]/.test(written) ||
			(property.pixels && !Number.isFinite(Number(value)))
		) {
			throw new Error(
				`The loading screen's "${part}" cannot be ${JSON.stringify(value)}.`
			);
		}

		set.push([property.name, written]);
	}

	return set;
}

/** A look as the words of a `style` attribute, for a screen written into a page. */
export function lookStyle(look: LoadingLook): string {
	return lookProperties(look)
		.map(([name, value]) => `${name}: ${value}`)
		.join("; ");
}
