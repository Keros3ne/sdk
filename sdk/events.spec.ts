/**
 * Playing a round out: that events are played in order, each waited for, that an emitter
 * tells every listener and waits for them all, and that a round's rows are played row by
 * row.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { describe, expect, it } from "vitest";
import { createEmitter, playEvents, playSteps, type Handlers } from "./events.ts";

type RowEvent =
	| { type: "spin"; grid: string[] }
	| { type: "win"; amountBp: number }
	| { type: "total"; payoutBp: number };

type StageEvent =
	{ type: "reelsSpin"; grid: string[] } | { type: "amount"; amountBp: number };

/** A promise that settles after a moment, and says so. */
const later = (log: string[], said: string, ms = 5) =>
	new Promise<void>((done) =>
		setTimeout(() => {
			log.push(said);
			done();
		}, ms)
	);

describe("an emitter", () => {
	it("tells every listener for a thing, and waits for them all", async () => {
		const emitter = createEmitter<StageEvent>();
		const log: string[] = [];

		emitter.on("reelsSpin", () => later(log, "reels stopped", 10));
		emitter.on("reelsSpin", () => later(log, "sound played", 2));
		emitter.on("amount", () => void log.push("amount"));

		await emitter.broadcast({ type: "reelsSpin", grid: [] });

		// Both ran at once, the quicker finishing first, and both were waited for.
		expect(log).toEqual(["sound played", "reels stopped"]);
		expect(emitter.listening("reelsSpin")).toBe(2);
	});

	it("stops telling a listener that has stopped listening", async () => {
		const emitter = createEmitter<StageEvent>();
		const heard: number[] = [];
		const stop = emitter.on("amount", (event) => void heard.push(event.amountBp));

		await emitter.broadcast({ type: "amount", amountBp: 1 });
		stop();
		await emitter.broadcast({ type: "amount", amountBp: 2 });

		expect(heard).toEqual([1]);
		expect(emitter.listening("amount")).toBe(0);
	});

	it("is not held up by a thing nothing listens for", async () => {
		await expect(
			createEmitter<StageEvent>().broadcast({ type: "amount", amountBp: 1 })
		).resolves.toBeUndefined();
	});
});

describe("events played", () => {
	const events: RowEvent[] = [
		{ type: "spin", grid: ["A", "B"] },
		{ type: "win", amountBp: 5_000 },
		{ type: "total", payoutBp: 5_000 }
	];

	it("are played in order, each finished before the next begins", async () => {
		const log: string[] = [];
		const handlers: Handlers<RowEvent> = {
			spin: () => later(log, "spin", 10),
			win: (event) => later(log, `win ${event.amountBp}`, 1),
			total: () => void log.push("total")
		};

		expect(await playEvents(events, handlers)).toBe(3);
		expect(log).toEqual(["spin", "win 5000", "total"]);
	});

	it("pass over an event no handler takes, and say so if asked", async () => {
		const unhandled: string[] = [];
		const log: string[] = [];

		await playEvents<RowEvent>(
			events,
			{ win: () => void log.push("win") },
			{ unhandled: (event) => unhandled.push(event.type) }
		);

		expect(log).toEqual(["win"]);
		expect(unhandled).toEqual(["spin", "total"]);
	});

	it("stop where they are told to", async () => {
		const log: string[] = [];
		const played = await playEvents<RowEvent>(
			events,
			{ spin: () => void log.push("spin"), win: () => void log.push("win") },
			{ stopped: () => log.length === 1 }
		);

		expect(played).toBe(1);
		expect(log).toEqual(["spin"]);
	});

	it("hand each handler what it was given to work with", async () => {
		const seen: number[] = [];

		await playEvents<RowEvent, { bet: number }>(
			events,
			{
				win: (event, context) =>
					void seen.push((context.bet * event.amountBp) / 10_000)
			},
			{ context: { bet: 200 } }
		);

		expect(seen).toEqual([100]);
	});
});

describe("a round's rows played", () => {
	const steps = [
		{
			table: "spin",
			events: [
				{ type: "spin", grid: ["A"] },
				{ type: "total", payoutBp: 0 }
			]
		},
		{
			table: "storm-gale",
			events: [
				{ type: "spin", grid: ["B"] },
				{ type: "win", amountBp: 9 }
			]
		}
	];

	it("are played row by row, each handler handed its row", async () => {
		const log: string[] = [];
		const handlers: Handlers<RowEvent, (typeof steps)[number]> = {
			spin: (event, step) => later(log, `${step.table} spin ${event.grid[0]}`, 3),
			win: (_event, step) => void log.push(`${step.table} win`)
		};

		await playSteps(steps, handlers);
		expect(log).toEqual(["spin spin A", "storm-gale spin B", "storm-gale win"]);

		// A round that went on after a choice is played from where it had got to.
		log.length = 0;
		await playSteps(steps.slice(1), handlers);
		expect(log).toEqual(["storm-gale spin B", "storm-gale win"]);
	});
});
