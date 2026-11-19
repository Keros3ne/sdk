<!--
The control bar: what every game is played with. Five segments, each kept whole: the menu;
the balance; the bet, with minus and plus; play, with autoplay and the speed of play; and
the last win. A game never draws its own bet, balance or play button.

What the bar shows is a prop (the balance, the last win, whether a round is under way),
what the player sets comes back (`bind:bet`), and `bind:bar` hands over the bar itself,
for the speed of play (`bar.pace()`) and the room it takes (`bar.inset()`):

    <ControlBar
      bets={[10, 20, 50, 100]} startBet={100} limits={host.init.limits}
      play={{ label: "Spin", symbol: "spin" }} onplay={spin}
      balance={balance} win={won} busy={spinning} bind:bet bind:bar
    />

The segments are the site's. A studio's, through `layout`, are where the bar is, its size,
a docked bar's width and side, the segments' order, hiding the menu or the win, and the
arrangement inside the bet's and play's segments (../bar-rules.ts). A layout that breaks
the rules throws. On a game 600px or narrower the bar is in two rows whatever was asked.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { barProperties, dress, segmentProperties, type BarLook } from "../look.ts";
	import { flushSync, untrack, type Snippet } from "svelte";
	import "../ui.css";
	import "../bar.css";
	import {
		AUTOPLAY_COUNTS,
		BAR_SCALE,
		BAR_SEGMENTS,
		BAR_WIDTH,
		BET_LABEL_LENGTH,
		CONTENT,
		MARGIN,
		NARROW,
		PACES,
		SEGMENT_SCALE,
		SMALLEST,
		SPEEDS,
		checkLayout,
		type BarLayout,
		type BarSegment,
		type BarHandle,
		type Speed,
		type StakeSteps
	} from "../bar-rules.ts";
	import { formatKero, parseKero } from "../kero.ts";
	import { stakeLadder } from "../stake-steps.ts";
	import Autoplay from "./Autoplay.svelte";
	import Popup from "./Popup.svelte";
	import Slider from "./Slider.svelte";
	import Mark from "./Mark.svelte";

	interface Props {
		/**
		 * How the bar looks: its colours, typefaces, buttons and segments (../look.ts). Left out,
		 * as the site draws it. It may change.
		 */
		look?: BarLook;
		/** The bets on offer, in cents: a list, or the steps the bet buttons move by. */
		bets: number[] | { steps: StakeSteps };
		startBet: number;
		limits: { minStake: number; maxStake: number };
		/** Other names for the bet, which `betLabel` may show in place of "Bet". */
		betLabels?: string[];
		/** What the big button does: its name for a screen reader, and how it is drawn. */
		play: { label: string; symbol: "spin" | "play" };
		onplay: () => void;
		/** Left out for a game that cannot play by itself: the button is not drawn. */
		autoplay?: {
			/** How many plays can be chosen. Ten to a hundred by tens, left out. */
			counts?: number[];
			/** What is played, singular and plural: `["spin", "spins"]`. */
			noun: [one: string, many: string];
			onstart: (count: number) => void;
			onstop: () => void;
			/** More settings for the autoplay popup. */
			content?: Snippet;
		};
		/** The speeds the button goes through. All three, left out. */
		speeds?: "turbo" | "fast" | "none";
		onspeed?: (speed: Speed) => void;
		onvolume?: (volume: number) => void;
		/** Where the bar is and how big. It may change; what is left out stays as it was. */
		layout?: BarLayout;
		/**
		 * What the bar is placed in and measured against. The whole page, as in a game's own
		 * frame; or `parent`, the element this is written in, which must be positioned: for
		 * a page that holds a game among other things.
		 */
		within?: "page" | "parent";
		/** The player's balance, in cents. */
		balance: number;
		/**
		 * What the last play won, in cents: 0 when a play starts, and what it won once that is
		 * shown. The bar keeps the last win of more than nothing in view: green while it is the
		 * last play's, greyed once a later play has started or won nothing.
		 */
		win?: number;
		/**
		 * Whether the bet can be typed, by pressing it. Left out, it cannot: the bet is one of
		 * those on offer. For the site's own table games, which take any amount.
		 */
		typed?: boolean;
		/** While a round is played or shown: the bet cannot be changed, nor play pressed. */
		busy?: boolean;
		/** How many plays of autoplay are left, as the game counts them down. */
		autoLeft?: number;
		/** What the next play will cost, when that is not the bet itself. `null` for the bet. */
		cost?: number | null;
		/** What the bet is called, one of `betLabels`. `null` for "Bet". */
		betLabel?: string | null;
		/** Free spins left, shown on the play button. `null` gives the button back. */
		freeSpins?: number | null;
		/** More about the play button for a screen reader. */
		playDescription?: string;
		/** Out: the bet chosen, in cents. */
		bet?: number;
		/** Out: the bar itself. */
		bar?: BarHandle;
		onbet?: (bet: number) => void;
		/** Called once the bar is made and in the page. */
		onready?: (bar: BarHandle) => void;
		/** More for the menu, under the volume. */
		menu?: Snippet;
	}

	let {
		look,
		bets: offered,
		startBet,
		limits,
		betLabels: otherNames,
		play,
		onplay,
		autoplay,
		speeds = "turbo",
		onspeed,
		onvolume,
		layout: asked,
		within = "page",
		balance,
		win,
		typed = false,
		busy: busyNow,
		autoLeft,
		cost: costNow,
		betLabel: nameNow,
		freeSpins: spinsNow,
		playDescription,
		bet = $bindable(),
		bar = $bindable(),
		onbet,
		onready,
		menu
	}: Props = $props();

	const clamp = (value: number, low: number, high: number) =>
		Math.max(low, Math.min(high, value));

	// The bets on offer, inside what the game takes. Fixed when the bar is made.
	const bets = untrack(() =>
		(Array.isArray(offered)
			? offered
			: stakeLadder({ min: limits.minStake, max: limits.maxStake }, offered.steps)
		).filter((offer) => offer >= limits.minStake && offer <= limits.maxStake)
	);

	// Every name the bet can have. Each is as long as the label has room for, or the bar is not made.
	const names = untrack(() => ["Bet", ...(otherNames ?? [])]);
	for (const name of names)
		if (!name.trim() || name.length > BET_LABEL_LENGTH)
			throw new Error(
				`A name for the bet must be 1 to ${BET_LABEL_LENGTH} characters: "${name}".`
			);

	// The bet to begin with: the one asked for, or if that is not on offer, the nearest below it.
	let stake = $state(
		untrack(() =>
			bets.includes(startBet)
				? startBet
				: (bets.findLast((offer) => offer <= startBet) ?? bets[0])
		)
	);
	let busy = $state(false);
	let speed = $state<Speed>(0);
	let volume = $state(1);
	let cost = $state<number | null>(null);
	let betName = $state("Bet");
	let freeSpins = $state<number | null>(null);
	let playLabel = $state(untrack(() => play.label));
	let left = $state(0);
	let ready = $state(0);
	// The balance is not read while the bar is being set up, only once it is in the page: a
	// page may hand over a balance it is still waiting for (the site's wallet, which its
	// layout awaits), and reading that before it has come stops the page being drawn at all.
	let shownBalance = $state(0);
	let shownWin = $state(0);
	// Whether the win in view is the last play's own. Otherwise it is an earlier play's, greyed.
	let winFresh = $state(false);
	let typing = $state(false);
	/** Which way the bar's popups open: away from the edge the bar is at. */
	let opens = $state<"up" | "down">("up");
	const betListeners: ((bet: number) => void)[] = [];

	// Where the bar is, how big and how laid out: the studio's choice.
	let layout = $state.raw<
		BarLayout & Required<Pick<BarLayout, "place" | "at" | "scale">>
	>(
		untrack(() => ({
			place: "bottom",
			at: { x: 0.5, y: 1 },
			scale: 1,
			...asked
		}))
	);
	checkLayout(untrack(() => layout));

	let element = $state<HTMLElement>();
	let playButton = $state<HTMLButtonElement>();
	let betOut = $state<HTMLButtonElement>();
	let betField = $state<HTMLInputElement>();
	let container: HTMLElement | undefined;
	let inset = { top: 0, bottom: 0 };

	// What the bar shows follows its props, where they are given.
	$effect(() => {
		shownBalance = balance;
	});
	$effect(() => {
		if (win !== undefined) setWin(win);
	});
	$effect(() => {
		if (busyNow !== undefined) busy = busyNow;
	});
	$effect(() => {
		if (autoLeft !== undefined) left = Math.max(0, autoLeft);
	});
	$effect(() => {
		if (costNow !== undefined) cost = costNow;
	});
	$effect(() => {
		if (nameNow !== undefined) setBetLabel(nameNow);
	});
	$effect(() => {
		if (spinsNow !== undefined)
			freeSpins = spinsNow === null ? null : Math.max(0, spinsNow);
	});
	$effect(() => {
		if (playDescription !== undefined) playLabel = playDescription;
	});
	$effect(() => {
		if (asked) setLayout(asked);
	});

	// The offers either side of the bet, which a typed bet may fall between.
	const lower = $derived(bets.findLast((offer) => offer < stake));
	const higher = $derived(bets.find((offer) => offer > stake));
	const locked = $derived(busy || left > 0);

	// The segments before play are one side of the bar, those after it the other: the two take
	// equal shares of it, so play is in its middle wherever there is room (bar.css).
	const order = $derived(layout.order ?? BAR_SEGMENTS);
	const before = $derived(order.slice(0, order.indexOf("play")));
	const after = $derived(order.slice(order.indexOf("play") + 1));

	/** How much bigger or smaller a segment is than the rest of the bar, if the studio said. */
	const sizeOf = (name: BarSegment) => {
		const size = layout.sizes?.[name];

		return size === undefined
			? undefined
			: clamp(size, SEGMENT_SCALE.min, SEGMENT_SCALE.max);
	};
	const hidden = (name: BarSegment) => (layout.hide ?? []).includes(name);

	// What play's button shows: its own symbol, or free spins left, or autoplay waiting for it
	// (a triangle and how many), or running (a square and how many are left).
	const face = $derived(
		freeSpins !== null ? "free" : left > 0 ? "stop" : ready > 0 ? "ready" : "play"
	);
	const faceCount = $derived(freeSpins ?? (left || ready));
	const plays = (count: number) => {
		const [one, many] = autoplay?.noun ?? ["play", "plays"];

		return `${count} ${count === 1 ? one : many}`;
	};
	const playName = $derived(
		freeSpins !== null
			? `Free spins, ${freeSpins} left`
			: left > 0
				? `Stop autoplay, ${plays(left)} left`
				: ready > 0
					? `Start autoplay, ${plays(ready)}`
					: playLabel
	);

	/** Sets the bet, and tells whoever asked to be told. */
	function setBet(next: number) {
		stake = next;
		bet = next;
		onbet?.(next);
		for (const listener of betListeners) listener(next);
	}

	/**
	 * What the last play won. Only a win of more than nothing replaces the one in view; nothing
	 * won, or a play starting, leaves it there and greys it.
	 */
	function setWin(cents: number) {
		if (cents > 0) shownWin = cents;

		winFresh = cents > 0;
	}

	/** The bet becomes a field to type one in. */
	function startTyping() {
		typing = true;
		// Drawn at once, so that the field is there to take the keyboard.
		flushSync();

		if (!betField) return;

		betField.value = formatKero(stake);
		betField.focus();
		betField.select();
	}

	/**
	 * The field becomes the bet again. A bet the game cannot take is brought inside its
	 * limits; one that cannot be read is dropped.
	 */
	function stopTyping(keep: boolean) {
		if (!typing) return;

		const entered = parseKero(betField?.value ?? "");

		typing = false;
		flushSync();
		betOut?.focus();
		if (keep && entered !== null)
			setBet(clamp(entered, limits.minStake, limits.maxStake));
	}

	/** Play: stops autoplay that is running, starts autoplay that is waiting, or plays once. */
	function pressPlay() {
		if (left > 0) return autoplay?.onstop();

		if (ready > 0) {
			const count = ready;

			ready = 0;

			return autoplay?.onstart(count);
		}

		onplay();
	}

	/** One press of the speed button goes on to the next speed, and round again. */
	function nextSpeed() {
		speed = ((speed + 1) % (speeds === "fast" ? 2 : SPEEDS.length)) as Speed;
		onspeed?.(speed);
	}

	/** What the bet is called, one of the names the bar was made with. */
	function setBetLabel(label: string | null) {
		const next = label ?? "Bet";
		if (!names.includes(next))
			throw new Error(`"${next}" is not one of the bar's betLabels.`);

		betName = next;
	}

	/** Moves, resizes or rearranges the bar. What is left out stays as it was. */
	function setLayout(next: BarLayout) {
		const merged = { ...untrack(() => layout), ...next };

		checkLayout(merged);
		layout = merged;
	}

	/**
	 * Puts the bar where it belongs in the game and sizes it, and says what room it takes.
	 * Measured and set by hand: each step depends on what the one before it came to.
	 */
	function place() {
		if (!element || !container) return;

		const width = container.clientWidth;
		const height = container.clientHeight;
		if (!element.isConnected || !width || !height) return;

		const narrow = width <= NARROW;
		// Two rows, by the game's width rather than the screen's (bar.css).
		element.toggleAttribute("data-narrow", narrow);
		// A narrow game has no room for a bar afloat: there it is docked, in two rows.
		const where = narrow && layout.place === "float" ? "bottom" : layout.place;
		// A bigger bar still has to fit across the game; at its usual size or under it is left as
		// asked. Two rows that do not fit at their usual size are made smaller, to three quarters.
		const room = width / (narrow ? CONTENT.narrow : CONTENT.wide);
		const fits = narrow ? Math.max(SMALLEST, room) : Math.max(1, room);
		const scale = Math.min(clamp(layout.scale, BAR_SCALE.min, BAR_SCALE.max), fits);

		element.dataset.place = where;
		element.style.setProperty("--bar-s", String(Math.round(scale * 1000) / 1000));

		// A docked bar may be narrower than the game, kept to one side; never on a narrow game.
		const share =
			narrow || where === "float"
				? 1
				: clamp(layout.width ?? 1, BAR_WIDTH.min, BAR_WIDTH.max);
		if (share < 1) {
			element.style.width = `${Math.round(share * width)}px`;
			element.style.minWidth = "max-content";
			element.style.right = "auto";
		} else {
			element.style.removeProperty("width");
			element.style.removeProperty("min-width");
			element.style.removeProperty("right");
		}

		// Where what is in the bar is wider than the room it has, the amounts drop their unit (KC),
		// which the labels make plain: so a bar made narrower by its studio still fits.
		element.removeAttribute("data-tight");
		const allowed = Math.round(share * width);
		if (
			element.scrollWidth > allowed + 1 ||
			element.getBoundingClientRect().width > allowed + 1
		)
			element.setAttribute("data-tight", "");

		// Measured from the game's top left, wherever the game is on the page.
		const origin = container.getBoundingClientRect();
		const measure = () => {
			const rect = element!.getBoundingClientRect();

			return {
				top: rect.top - origin.top,
				bottom: rect.bottom - origin.top,
				width: rect.width,
				height: rect.height
			};
		};
		let box = measure();

		if (where === "float") {
			const left = clamp(
				layout.at.x * width - box.width / 2,
				MARGIN,
				Math.max(MARGIN, width - box.width - MARGIN)
			);
			const top = clamp(
				layout.at.y * height - box.height / 2,
				MARGIN,
				Math.max(MARGIN, height - box.height - MARGIN)
			);

			element.style.left = `${Math.round(left)}px`;
			element.style.top = `${Math.round(top)}px`;
			box = measure();
		} else if (share < 1) {
			// Never narrower than what is in it: the width asked for may have grown to fit.
			const spare = Math.max(0, width - box.width);
			const align = layout.align ?? "center";
			const left = align === "start" ? 0 : align === "end" ? spare : spare / 2;

			element.style.left = `${Math.round(left)}px`;
			element.style.removeProperty("top");
			box = measure();
		} else {
			element.style.removeProperty("left");
			element.style.removeProperty("top");
		}

		// Which edge the bar is at, or nearer: its popups open away from it, and a game draws clear of it.
		const atTop =
			where === "top" ||
			(where === "float" && box.top + box.height / 2 < height / 2);
		opens = atTop ? "down" : "up";

		// Rounded up, from the game's exact height (`clientHeight` is rounded to a whole pixel):
		// a game drawing clear of the bar must never be a fraction of a pixel under it.
		inset = atTop
			? { top: Math.ceil(box.bottom - 0.01), bottom: 0 }
			: { top: 0, bottom: Math.ceil(origin.height - box.top - 0.01) };
		container.style.setProperty("--sdk-bar-top", `${inset.top}px`);
		container.style.setProperty("--sdk-bar-bottom", `${inset.bottom}px`);
	}

	/** The bar as a game holds it: what it may ask of the bar and tell it. */
	const api: BarHandle = {
		get element() {
			return element!;
		},
		get bet() {
			return stake;
		},
		get speed() {
			return speed;
		},
		quick: (inBonus = false) => speed === 2 || (speed === 1 && !inBonus),
		pace: (inBonus = false) => PACES[speed === 1 && inBonus ? 0 : speed],
		get volume() {
			return volume;
		},
		get busy() {
			return busy;
		},
		set busy(next: boolean) {
			busy = next;
		},
		get autoLeft() {
			return left;
		},
		set autoLeft(next: number) {
			left = Math.max(0, next);
		},
		setBalance: (cents) => void (shownBalance = cents),
		setWin,
		setCost: (cents) => void (cost = cents),
		setBetLabel,
		setFreeSpins: (spins) =>
			void (freeSpins = spins === null ? null : Math.max(0, spins)),
		onBet: (listener) => void betListeners.push(listener),
		describePlay: (label) => void (playLabel = label),
		focusPlay: () => playButton?.focus({ preventScroll: true }),
		top: () =>
			element!.getBoundingClientRect().top -
			(container?.getBoundingClientRect().top ?? 0),
		rect() {
			place();

			const box = element!.getBoundingClientRect();
			const origin = container!.getBoundingClientRect();

			return {
				left: box.left - origin.left,
				top: box.top - origin.top,
				width: box.width,
				height: box.height
			};
		},
		inset() {
			place();

			return inset;
		},
		setLayout
	};

	/**
	 * Once the bar is drawn: it is told what it is placed in, marks that as where its popups
	 * must keep, and is placed again whenever the game or the bar changes size. An observer reports each thing
	 * it watches as soon as it starts, which also places the bar the first time.
	 */
	function mount(footer: HTMLElement) {
		const around = within === "parent" ? footer.parentElement : null;

		container = around ?? document.documentElement;
		// The bar's popups keep inside it (Popup.svelte).
		container.dataset.sdkBounds = "";

		const watcher = new ResizeObserver(place);
		watcher.observe(container);
		watcher.observe(footer);

		untrack(() => {
			bet = stake;
			bar = api;
			onready?.(api);
		});

		return () => {
			watcher.disconnect();
			bar = undefined;
		};
	}

	// The bar is drawn in the browser only. It is placed by measuring the game it is in, which
	// a server cannot do, and a page drawn by a server shows its own loading until the bar is in.
	// Known from the start, not found out in an effect: a page being taken over from a
	// server must not have what it draws change under it part way.
	const drawn = typeof document !== "undefined";

	// Laid out anew, the bar is placed anew.
	$effect(() => {
		void layout;
		place();
	});
</script>

{#snippet amount(cents: number)}{formatKero(cents)}<span class="sdk-bar-unit">
		{" KC"}
	</span>{/snippet}

{#snippet betFace()}<span class="sdk-bar-label sdk-bar-betlabel">
		{#each names as name}<span class={{ "sdk-bar-betlabel-on": name === betName }}>
				{name}
			</span>{/each}
	</span><output>{formatKero(cost ?? stake)}</output>{/snippet}

{#snippet segment(name: BarSegment)}
	{#if name === "menu"}
		<div
			class="sdk-bar-segment"
			data-segment="menu"
			{@attach dress(() => segmentProperties(look?.segments?.menu))}
			hidden={hidden("menu")}
			style:--segment-scale={sizeOf("menu")}
		>
			<Popup
				label="Menu"
				class="sdk-bar-menu"
				buttonClass="sdk-bar-button"
				{opens}
				buttonProps={{ "aria-label": "Menu" }}
			>
				{#snippet face()}<Mark name="menu" />{/snippet}
				<Slider
					label="Volume"
					bind:value={volume}
					step={0.1}
					onchange={(value) => onvolume?.(value)}
				/>{@render menu?.()}
			</Popup>
		</div>
	{:else if name === "balance"}
		<div
			class="sdk-bar-segment"
			data-segment="balance"
			{@attach dress(() => segmentProperties(look?.segments?.balance))}
			hidden={hidden("balance")}
			style:--segment-scale={sizeOf("balance")}
		>
			<div class="sdk-bar-readout sdk-bar-balance">
				<span class="sdk-bar-label">Balance</span><output>
					{@render amount(shownBalance)}
				</output>
			</div>
		</div>
	{:else if name === "bet"}
		<div
			class="sdk-bar-bet sdk-bar-segment"
			role="group"
			aria-label="Bet"
			data-segment="bet"
			{@attach dress(() => segmentProperties(look?.segments?.bet))}
			data-arrange={layout.arrange?.bet ?? "split"}
			hidden={hidden("bet")}
			style:--segment-scale={sizeOf("bet")}
		>
			<button
				type="button"
				class="sdk-bar-button sdk-bar-minus"
				aria-label="Lower the bet"
				disabled={locked || lower === undefined}
				onclick={() => setBet(lower ?? stake)}
			>
				<Mark name="minus" />
			</button>{#if typed}<button
					type="button"
					class="sdk-bar-readout sdk-bar-betvalue"
					bind:this={betOut}
					aria-label="{betName} {formatKero(
						cost ?? stake
					)}. Press to type a bet."
					disabled={locked}
					hidden={typing}
					onclick={startTyping}
				>
					{@render betFace()}
				</button><input
					class="sdk-bar-betfield"
					bind:this={betField}
					inputmode="decimal"
					autocomplete="off"
					aria-label="Bet"
					hidden={!typing}
					onkeydown={(event) => {
						if (event.key !== "Enter" && event.key !== "Escape") return;

						// Handled here: left to the browser, the same Enter presses the bet's button,
						// which focus has just moved back to, and opens the field again.
						event.preventDefault();
						stopTyping(event.key === "Enter");
					}}
					onblur={() => stopTyping(true)}
				/>{:else}<div class="sdk-bar-readout sdk-bar-betvalue">
					{@render betFace()}
				</div>{/if}<button
				type="button"
				class="sdk-bar-button sdk-bar-plus"
				aria-label="Raise the bet"
				disabled={locked || higher === undefined}
				onclick={() => setBet(higher ?? stake)}
			>
				<Mark name="plus" />
			</button>
		</div>
	{:else if name === "win"}
		<div
			class="sdk-bar-segment"
			data-segment="win"
			{@attach dress(() => segmentProperties(look?.segments?.win))}
			hidden={hidden("win")}
			style:--segment-scale={sizeOf("win")}
		>
			<div
				class="sdk-bar-readout sdk-bar-win"
				data-fresh={winFresh ? "" : undefined}
			>
				<span class="sdk-bar-label">Win</span><output>
					{@render amount(shownWin)}
				</output>
			</div>
		</div>
	{/if}
{/snippet}

{#if drawn}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<footer
		class="sdk-bar"
		{@attach dress(() => barProperties(look))}
		role="group"
		aria-label="Game controls"
		bind:this={element}
		onkeydown={(event) => {
			// Escape puts away autoplay that is waiting. With the popup open, the popup takes it to close.
			if (event.key !== "Escape" || ready === 0 || left > 0) return;

			ready = 0;
		}}
		{@attach mount}
	>
		<div class="sdk-bar-left">
			{#each before as name (name)}{@render segment(name)}{/each}
		</div>
		<div
			class="sdk-bar-segment"
			data-segment="play"
			{@attach dress(() => segmentProperties(look?.segments?.play))}
			data-arrange={layout.arrange?.play ?? "split"}
			hidden={hidden("play")}
			style:--segment-scale={sizeOf("play")}
		>
			{#if autoplay}
				<Autoplay
					counts={autoplay.counts ?? AUTOPLAY_COUNTS}
					noun={autoplay.noun}
					startFrom="play"
					{left}
					bind:ready
					disabled={busy && left === 0}
					{opens}
					class="sdk-bar-auto"
					buttonClass="sdk-bar-button"
					onstart={autoplay.onstart}
					onstop={autoplay.onstop}
				>
					{#snippet symbol()}<Mark name="auto" />{/snippet}
					{@render autoplay.content?.()}
				</Autoplay>
			{:else}
				<!-- Autoplay in a game that has none: never shown, and taking no room, so that play
			     stays in the middle of its segment. -->
				<div class="sdk-popup sdk-bar-auto" hidden>
					<button
						type="button"
						class="sdk-autoplay sdk-bar-button"
						disabled
						hidden
						aria-label="Autoplay: not in this game"
					>
						<Mark name="auto" />
					</button>
				</div>
			{/if}<button
				type="button"
				class="sdk-bar-play"
				bind:this={playButton}
				aria-label={playName}
				data-auto={face}
				disabled={freeSpins !== null || (busy && left === 0)}
				onclick={pressPlay}
			>
				{#if face === "play"}<Mark name={play.symbol} />{:else}<span
						class="sdk-bar-play-auto"
					>
						<Mark name={face === "free" ? "spin" : face} /><span
							class="sdk-bar-play-count"
						>
							{faceCount}
						</span>
					</span>{/if}
			</button><button
				type="button"
				class="sdk-bar-button sdk-bar-speed"
				aria-label={speeds === "none"
					? "Speed: not in this game"
					: `Speed: ${SPEEDS[speed]}`}
				title={speeds === "none"
					? ""
					: speed === 1 && speeds === "turbo"
						? "Fast: bonuses play at their own pace"
						: `Speed: ${SPEEDS[speed]}`}
				data-speed={speed}
				hidden={speeds === "none"}
				onclick={nextSpeed}
			>
				<Mark name={speed === 2 ? "turbo" : "fast"} />
			</button>
		</div>
		<div class="sdk-bar-right">
			{#each after as name (name)}{@render segment(name)}{/each}
		</div>
	</footer>
{/if}
