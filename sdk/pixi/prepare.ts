/// <reference path="../pixi.d.ts" />
/**
 * Pixi made ready for the frame a game is played in. The policy a client is served under
 * (../frame.ts) allows no eval, no requests and no workers, and Pixi as it comes wants
 * all three. Two settings make it need none of them, and everything the SDK draws with
 * Pixi goes through here so that they are always made (`e2e/pixi-frame.e2e.ts` holds
 * that they are enough, and that neither can be left out).
 *
 * The line above this brings in what Pixi leaves undeclared (../pixi.d.ts), wherever this
 * file is read from: a site that takes the SDK as a dependency reads only what it imports.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { Assets, Cache, ImageSource, Texture } from "pixi.js";

let prepared: Promise<void> | null = null;

/**
 * Makes Pixi safe for the frame, once, however often it is asked. Await it before
 * anything is drawn or loaded.
 */
export function preparePixi(): Promise<void> {
	prepared ??= (async () => {
		// Pixi builds its shader plumbing with `new Function` unless this is loaded first.
		await import("pixi.js/unsafe-eval");

		// A picture is loaded by an image element. As Pixi comes it is fetched from a worker
		// made of a blob, and under the policy it is not refused: it never arrives.
		await Assets.init({
			preferences: { preferWorkers: false, preferCreateImageBitmap: false }
		});
	})();

	return prepared;
}

/** One picture, loaded by an image element and made into a texture. */
async function pictureOf(src: string): Promise<Texture> {
	const image = new Image();

	// A client's page has an origin of its own (the frame is sandboxed), so its own files
	// are another origin's to it: asked for as such, or the picture cannot be drawn with.
	image.crossOrigin = "anonymous";
	image.src = src;
	await image.decode();

	return new Texture({ source: new ImageSource({ resource: image }) });
}

/**
 * Loads a game's pictures by name: `{ lantern: "./art/lantern.png" }`. A sprite then
 * names its picture (`texture="lantern"`). Addresses are the client's own, relative to
 * its page, or pictures written out in the address itself (`data:`): the policy lets a
 * client load from its own folder and nowhere else.
 *
 * Each is loaded by an image element, here, and not by Pixi's own loaders: some of those
 * (a picture that is an SVG, for one) ask for the file with a request, which the policy
 * stops, whatever the settings above.
 */
export async function loadPictures(
	pictures: Readonly<Record<string, string>>
): Promise<void> {
	await preparePixi();

	await Promise.all(
		Object.entries(pictures).map(async ([alias, src]) => {
			if (Cache.has(alias)) return;

			Cache.set(alias, await pictureOf(src));
		})
	);
}
