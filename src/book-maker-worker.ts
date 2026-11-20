/**
 * One of the workers a game's books are made on (./book-maker.ts): it imports the game's
 * maths, and plays whatever stretch of a table's rounds it is sent, as often as it is sent
 * one. It runs on the studio's machine, where that maths is the studio's own.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { parentPort } from "node:worker_threads";
import { loadMaths, playStretch, type Stretch } from "./book-maker.ts";

if (!parentPort)
	throw new Error("This file is a worker: it is started by book-maker.ts.");

const port = parentPort;

port.on("message", async (stretch: Stretch & { maths: string }) => {
	try {
		const maths = await loadMaths(stretch.maths);
		const played = playStretch(maths, stretch);

		// Handed over, not copied: a stretch is a few hundred kilobytes of figures.
		port.postMessage({ played }, [
			played.values.buffer as ArrayBuffer,
			played.groups.buffer as ArrayBuffer
		]);
	} catch (error) {
		port.postMessage({
			problem: error instanceof Error ? error.message : String(error)
		});
	}
});
