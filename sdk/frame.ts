/**
 * How a studio game's client is served: the kinds of file it may be made of, and the
 * policy and headers every one of its files is served with. The site serves a client
 * this way, and so does `keros3ne-studio dev`, so a game that loads there loads on the
 * site.
 */

/** The only kinds of file a client may consist of, by extension. */
export const CLIENT_FILE_TYPES: Readonly<Record<string, string>> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav"
};

/**
 * The policy a client is served under. With `sandbox` and no `allow-same-origin`
 * the page has an origin of its own: it cannot read the site's cookies or
 * storage, or reach into the page that frames it, even if opened directly. It may
 * load scripts, styles, art and sound from its own folder and nowhere else, and
 * may not make requests of its own at all.
 */
export function studioPolicy(origin: string, slug: string): string {
	const own = `${origin}/studio-frame/${slug}/`;
	return [
		"sandbox allow-scripts",
		"default-src 'none'",
		`script-src ${own}`,
		`style-src ${own} 'unsafe-inline'`,
		`img-src ${own} data: blob:`,
		`media-src ${own} data: blob:`,
		`font-src ${own}`,
		"connect-src 'none'",
		"base-uri 'none'",
		"form-action 'none'",
		`frame-ancestors ${origin}`
	].join("; ");
}

/**
 * A file the client's build named by what is in it
 * (`_app/immutable/chunks/BeiYQHnb.js`): the same name is always the same file, so a
 * browser may keep it for good.
 */
const NAMED_BY_CONTENT = /^_app\/immutable\/.+\.[a-z0-9]+$/;

/**
 * Every header a file of a client is served with. `file` is its path in the client's
 * folder: one named by what is in it is kept by the browser and not asked for again, and
 * everything else (the page, what `public` brought, a file not named) is asked for each time.
 */
export function clientHeaders(
	origin: string,
	slug: string,
	type: string,
	file = ""
): Record<string, string> {
	return {
		"Content-Type": type,
		"Content-Security-Policy": studioPolicy(origin, slug),
		// The sandboxed page's origin is not the site's, so its own scripts and
		// fonts are cross-origin requests to it and need this to load.
		"Access-Control-Allow-Origin": "*",
		"Cross-Origin-Resource-Policy": "cross-origin",
		"Cache-Control": NAMED_BY_CONTENT.test(file.replace(/^\/+/, ""))
			? "public, max-age=31536000, immutable"
			: "no-cache"
	};
}
