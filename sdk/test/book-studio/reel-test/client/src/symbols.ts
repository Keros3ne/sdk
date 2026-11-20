/**
 * The symbols, drawn: plain shapes on a 48 by 48 grid, in the game's own colours, each on
 * its tile. Drawn, not emoji, which show as empty boxes where no emoji font is installed;
 * and written out here as pictures the stage loads by name, so there are no files to load.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { SymbolName } from "../../maths/rules";

export const DRAWN: Record<SymbolName, string> = {
	lighthouse: `<path d="M19 40l3-24h4l3 24z" fill="#f4efe6"/><path d="M20.2 31h7.6M21 24h6" stroke="#c8423b" stroke-width="3"/><rect x="20" y="10" width="8" height="6" rx="1" fill="#ffd56b"/><path d="M18 10h12l-6-5z" fill="#c8423b"/><path d="M28 13l12-4v8zM20 13L8 9v8z" fill="#ffd56b" opacity=".45"/><path d="M12 41h24" stroke="#5b8fa8" stroke-width="2.5" stroke-linecap="round"/>`,
	anchor: `<circle cx="24" cy="11" r="4" fill="none" stroke="#e3c27a" stroke-width="3"/><path d="M24 15v24M16 21h16" stroke="#e3c27a" stroke-width="3" stroke-linecap="round"/><path d="M10 29c2 7 8 10 14 10s12-3 14-10" fill="none" stroke="#e3c27a" stroke-width="3" stroke-linecap="round"/>`,
	buoy: `<path d="M15 34l9-22 9 22z" fill="#e2603a"/><path d="M18.5 26h11" stroke="#f4efe6" stroke-width="3"/><path d="M8 37c5-3 9 3 16 0s11-3 16 0" fill="none" stroke="#5b8fa8" stroke-width="3" stroke-linecap="round"/>`,
	shell: `<path d="M24 38L10 22a14 14 0 0 1 28 0z" fill="#f2b5b0"/><path d="M24 38l-8-20M24 38V14M24 38l8-20" stroke="#b9615c" stroke-width="2"/>`,
	fish: `<path d="M8 24c6-8 18-9 26 0-8 9-20 8-26 0z" fill="#7ec4cf"/><path d="M34 24l7-6v12z" fill="#7ec4cf"/><circle cx="15" cy="22" r="2" fill="#173341"/>`
};

export const NAMES: Record<SymbolName, string> = {
	lighthouse: "lighthouse",
	anchor: "anchor",
	buoy: "buoy",
	shell: "shell",
	fish: "fish"
};

/** A symbol's picture on its tile, as an address the stage can load. */
function pictureOf(symbol: SymbolName): string {
	const tile = `<rect x="2" y="2" width="56" height="56" rx="6" fill="#1d4152"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="240" height="240">${tile}<g transform="translate(6 6)">${DRAWN[symbol]}</g></svg>`;

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Every symbol's picture, by the symbol's name: what the stage is handed to load. */
export const PICTURES = Object.fromEntries(
	(Object.keys(DRAWN) as SymbolName[]).map((symbol) => [symbol, pictureOf(symbol)])
) as Record<SymbolName, string>;
