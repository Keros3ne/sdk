<!--
Autoplay as one button, so that a game's row of controls is the same size whether or not
it is running. Pressed, it opens a popup to choose how many plays and start them, which
closes it. While they run it shows a stop sign and how many are left, and pressing it
stops them.

The game does the playing: `onstart` is told how many were asked for, the game sets `left`
as it goes, and `onstop` is called when the player stops.

With `startFrom="play"` (the control bar's), choosing a number only readies it: the popup
offers Off and the numbers in a grid, with no Start, and closes when one is chosen. Whatever has the play button starts and stops
the plays (`ready`, `onready`), and this button cannot be pressed while they run.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { ControlLook } from "../look.ts";
	import type { Snippet } from "svelte";
	import Choices from "./Choices.svelte";
	import Popup from "./Popup.svelte";

	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		/** How many plays can be chosen. The first is chosen to begin with. */
		counts: readonly number[];
		/** What is played, singular and plural: `["spin", "spins"]`. */
		noun: [one: string, many: string];
		/** `popup` (left out): the popup's Start begins the plays. `play`: a play button does. */
		startFrom?: "popup" | "play";
		/** How many plays are left. The game sets it as they run. */
		left?: number;
		/** With `startFrom="play"`: how many plays are chosen and waiting, 0 for none. */
		ready?: number;
		disabled?: boolean;
		/** A symbol to show in place of the word "Auto". The button is still called Auto. */
		symbol?: Snippet;
		/** Which way the popup opens. Up, left out. */
		opens?: "up" | "down";
		/** More classes for the popup itself, and for its button. */
		class?: string;
		buttonClass?: string;
		/** With `startFrom="play"`: called when the number waiting changes, 0 for none. */
		onready?: (count: number) => void;
		onstart: (count: number) => void;
		onstop: () => void;
		/** More settings for the popup, above the button that starts it. */
		children?: Snippet;
	}

	let {
		look,
		counts,
		noun,
		startFrom = "popup",
		left = 0,
		ready = $bindable(0),
		disabled = false,
		symbol,
		opens,
		class: popupClass,
		buttonClass,
		onready,
		onstart,
		onstop,
		children
	}: Props = $props();

	const fromPlay = $derived(startFrom === "play");
	const [one, many] = $derived(noun);
	const heading = $derived(`${many[0].toUpperCase()}${many.slice(1)} to play`);
	const plays = (count: number) => `${count} ${count === 1 ? one : many}`;

	let popup = $state<ReturnType<typeof Popup>>();
	/** How many the popup's Start would begin. */
	let chosen = $state<number>();
	const count = $derived(chosen ?? counts[0]);

	/** What the button is called for a screen reader, where its face does not say. */
	const name = $derived.by(() => {
		if (fromPlay) return ready > 0 ? `Auto: ${plays(ready)} ready` : "Auto";

		if (left > 0) return `Stop autoplay, ${plays(left)} left`;

		return symbol ? "Auto" : undefined;
	});

	/** The popup's own elements, for whatever has made this and must reach into it. */
	export const parts = () => popup!.parts();

	// Plays under way: the choice is put away.
	$effect(() => {
		if (left > 0) popup?.close(false);
	});
</script>

{#snippet face()}{#if !fromPlay && left > 0}<span class="sdk-stop"
		></span>{left}{:else if symbol}{@render symbol()}{:else}Auto{/if}{/snippet}

<Popup
	bind:this={popup}
	{look}
	label="Auto"
	title="Autoplay"
	{opens}
	class={popupClass}
	buttonClass={["sdk-autoplay", buttonClass].filter(Boolean).join(" ")}
	buttonProps={{ "aria-label": name, "data-ready": ready > 0 ? "" : undefined }}
	disabled={disabled || (fromPlay && left > 0)}
	onpress={() => {
		if (left === 0) return true;

		onstop();

		return false;
	}}
	{face}
>
	{#if fromPlay}<Choices
			label={heading}
			grid
			options={[
				{ value: 0, label: "Off" },
				...counts.map((value) => ({ value, label: String(value) }))
			]}
			bind:value={ready}
			onchange={(value) => onready?.(value)}
			onpick={() => popup?.close()}
		/>{:else}<Choices
			label={heading}
			options={counts.map((value) => ({ value, label: String(value) }))}
			value={count}
			onchange={(value) => (chosen = value)}
		/>{/if}{@render children?.()}{#if !fromPlay}<button
			type="button"
			class="sdk-start"
			onclick={() => {
				popup?.close();
				onstart(count);
			}}
		>
			Start
		</button>{/if}
</Popup>

<style>
	/* A square, for a button that stops something. Drawn, so it needs no font to have it. */
	.sdk-stop {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		margin-right: 0.45em;
		border-radius: 2px;
		background: currentColor;
	}

	/* The autoplay button keeps its width whether it says "Auto" or counts down behind a stop sign. */
	:global(.sdk-autoplay) {
		min-width: 5em;
	}

	/* The button in a popup that sets something going: the one main action, solid ink. */
	.sdk-start {
		width: 100%;
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid var(--sdk-main, var(--sdk-ink, #f2f2f2));
		border-radius: var(--sdk-radius, 999px);
		background: var(--sdk-main, var(--sdk-ink, #f2f2f2));
		color: var(--sdk-on-main, #17181a);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}

	.sdk-start:focus-visible {
		outline: 2px solid var(--sdk-accent, #8ab4f8);
		outline-offset: 2px;
	}
</style>
