/**
 * Playing a round out. A round from a game's books is rows, and a row is a list of events
 * in the order things happened (./book.ts). A client plays them one after another: each
 * event has a handler, which tells the pieces of the drawing what to do and waits for
 * them to have done it before the next event is played.
 *
 * Handlers do not reach into the pieces. They broadcast what should happen on an emitter
 * (reels, spin to this grid), and whichever pieces listen for that do it. A piece can
 * then be drawn, played and tested by itself: hand it the one thing it listens for.
 *
 * Pure: no Svelte and no Pixi. `./emitter.svelte.ts` ties an emitter to components.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

/** Anything with a `type` to tell it by. */
export interface Typed {
	type: string;
}

/** What listens for one kind of thing: it may take its time, and is waited for. */
export type Listener<Event> = (event: Event) => void | Promise<void>;

export interface Emitter<Events extends Typed> {
	/** Listens for one kind of thing. Returns what stops listening. */
	on<Type extends Events["type"]>(
		type: Type,
		listener: Listener<Extract<Events, { type: Type }>>
	): () => void;
	/**
	 * Tells every listener for a thing, and waits until all of them have finished: the
	 * reels have stopped, the amounts have counted up. Listeners run at the same time.
	 */
	broadcast(event: Events): Promise<void>;
	/** How many are listening for one kind of thing: for a test, or to find a piece missing. */
	listening(type: Events["type"]): number;
}

/** A new emitter, with nothing listening. */
export function createEmitter<Events extends Typed>(): Emitter<Events> {
	const listeners = new Map<string, Set<Listener<never>>>();

	return {
		on(type, listener) {
			const set = listeners.get(type) ?? new Set();

			set.add(listener as Listener<never>);
			listeners.set(type, set);

			return () => set.delete(listener as Listener<never>);
		},

		async broadcast(event) {
			const set = listeners.get(event.type);
			if (!set) return;

			await Promise.all(
				[...set].map((listener) => (listener as Listener<Events>)(event))
			);
		},

		listening: (type) => listeners.get(type)?.size ?? 0
	};
}

/** A handler for each kind of event a game's rows hold. One may be left out: see `playEvents`. */
export type Handlers<Event extends Typed, Context = undefined> = {
	[Type in Event["type"]]?: (
		event: Extract<Event, { type: Type }>,
		context: Context
	) => void | Promise<void>;
};

export interface PlayOptions<Context> {
	/** Handed to every handler: what it needs beyond the event, such as the bet. */
	context: Context;
	/** Called for an event no handler takes. Left out, such an event is passed over. */
	unhandled?: (event: Typed) => void;
	/** Asked before each event: once it says so, nothing more is played. */
	stopped?: () => boolean;
}

/**
 * Plays events in order, each handler finished before the next begins. Returns how many
 * were played, which is all of them unless `stopped` said to stop.
 */
export async function playEvents<Event extends Typed, Context = undefined>(
	events: readonly Typed[],
	handlers: Handlers<Event, Context>,
	...[options]: undefined extends Context
		? [options?: Partial<PlayOptions<Context>>]
		: [
				options:
					| PlayOptions<Context>
					| (Partial<PlayOptions<Context>> & { context: Context })
			]
): Promise<number> {
	const handlerOf = handlers as Record<
		string,
		((event: Typed, context: Context) => void | Promise<void>) | undefined
	>;
	let played = 0;

	for (const event of events) {
		if (options?.stopped?.()) return played;

		const handler = handlerOf[event.type];

		if (handler) await handler(event, options?.context as Context);
		else options?.unhandled?.(event);

		played += 1;
	}

	return played;
}

/** A row of a round, as far as playing it goes: its events, and whatever else it carries. */
export interface PlayableStep {
	events: readonly Typed[];
}

/**
 * Plays the rows of a round in order, each row's events in order. A handler is handed
 * the row its event is in. A round that stopped at a choice and went on is played from
 * where it had got to: pass the rows not yet played (`steps.slice(played)`).
 */
export async function playSteps<Event extends Typed, Step extends PlayableStep>(
	steps: readonly Step[],
	handlers: Handlers<Event, Step>,
	options: Omit<PlayOptions<Step>, "context"> = {}
): Promise<void> {
	for (const step of steps) {
		if (options.stopped?.()) return;

		await playEvents<Event, Step>(step.events, handlers, {
			...options,
			context: step
		});
	}
}
