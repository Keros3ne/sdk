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

import {
	Application,
	Assets,
	BufferImageSource,
	Cache,
	ImageSource,
	Texture,
	WebGLRenderer,
	type ApplicationOptions
} from "pixi.js";

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

		// Pixi's own white, one opaque pixel it draws every plain shape with, is uploaded
		// with a setting browsers have deprecated for anything but a picture or a canvas,
		// and one says so in the console. Opaque white is the same either way.
		Texture.WHITE.source.alphaMode = "premultiplied-alpha";

		// Pixi's own empty texture, which it puts wherever a texture is wanted and none is
		// given, has nothing in it at all: the browser fills it in the first time it is drawn
		// with, and one says so in the console. Given its one clear pixel, there is nothing
		// to fill in, and it draws the same.
		Texture.EMPTY.source = new BufferImageSource({
			resource: new Uint8Array(4),
			width: 1,
			height: 1,
			alphaMode: "premultiplied-alpha",
			label: "EMPTY"
		});
	})();

	return prepared;
}

/** What Pixi adds to an application as it is made: its ticker, its resizing. */
interface Plugin {
	init(this: Application, options: Partial<ApplicationOptions>): void;
}

/**
 * Makes a Pixi application that draws with WebGL, ready for the frame.
 *
 * Not by Pixi's own `init`, which first finds out whether there is WebGL at all by making
 * a context only to throw it away, and a browser writes in the console that a context was
 * lost. The renderer is made here directly, and what `init` does after it is done here
 * too. Where that fails (no WebGL), Pixi is left to choose for itself, as before.
 */
export async function makeApplication(
	options: Partial<ApplicationOptions>
): Promise<Application> {
	await preparePixi();

	try {
		const application = new Application();
		const renderer = new WebGLRenderer();
		await renderer.init(options);
		application.renderer = renderer;

		const { _plugins: plugins } = Application as unknown as { _plugins: Plugin[] };
		for (const plugin of plugins) plugin.init.call(application, options);

		return application;
	} catch {
		const application = new Application();
		await application.init({ ...options, preference: "webgl" });

		return application;
	}
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
