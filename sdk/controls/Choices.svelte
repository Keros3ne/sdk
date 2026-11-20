<!--
One of a few options, all in view side by side: radio buttons the game draws. It follows
the radio group pattern: Tab reaches the one chosen, and the arrow keys move the choice.
`bind:value` is the option chosen.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts" generics="Value extends string | number">
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	import { flushSync } from "svelte";
	import type { MenuOption } from "../ui.ts";

	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		options: MenuOption<Value>[];
		value: Value;
		/** While a round is played: none of them can be chosen. */
		disabled?: boolean;
		onchange?: (value: Value) => void;
		/**
		 * Laid out as a grid, five to a line (or the number given), for more options than a row holds: the first
		 * takes a line of its own where that leaves the rest in whole lines (an Off over tens).
		 */
		grid?: boolean | number;
		/** Called when an option is pressed, the one already chosen too: to close what holds this. */
		onpick?: (value: Value) => void;
	}

	let {
		look,
		label,
		options,
		value = $bindable(),
		disabled = false,
		onchange,
		grid = false,
		onpick
	}: Props = $props();

	// The same on a server and in the browser that takes its page over.
	const uid = $props.id();
	const id = `sdk-choices-${uid}`;
	let row = $state<HTMLElement>();

	// The option chosen: the first, where the value names none of them.
	const selected = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);

	const columns = $derived(typeof grid === "number" ? grid : 5);

	/** Chooses an option, going round at either end, and with `focus` moves the keyboard to it. */
	function choose(index: number, focus = false) {
		const next = (index + options.length) % options.length;
		const changed = next !== selected;

		value = options[next].value;
		flushSync();
		if (focus) (row?.children[next] as HTMLElement | undefined)?.focus();
		if (changed) onchange?.(value);
	}

	/** The arrow keys move the choice, and Home and End go to its ends. */
	function onkeydown(event: KeyboardEvent) {
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			choose(selected + 1, true);
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			choose(selected - 1, true);
		else if (event.key === "Home") choose(0, true);
		else if (event.key === "End") choose(options.length - 1, true);
		else return;

		event.preventDefault();
	}
</script>

<div
	class="sdk-choices"
	{@attach dress(() => controlProperties(look))}
	role="radiogroup"
	aria-labelledby="{id}-label"
>
	<span class="sdk-choices-label" id="{id}-label">
		{label}
	</span><!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="sdk-choices-row"
		data-grid={grid ? "" : undefined}
		data-lead={grid === true && options.length % columns === 1 ? "" : undefined}
		style:--sdk-columns={grid ? columns : undefined}
		bind:this={row}
		{onkeydown}
	>
		{#each options as option, index}<button
				type="button"
				class="sdk-choice"
				role="radio"
				aria-checked={String(index === selected) as "true" | "false"}
				tabindex={index === selected ? 0 : -1}
				{disabled}
				onclick={() => {
					choose(index);
					onpick?.(option.value);
				}}
			>
				{option.label}
			</button>{/each}
	</div>
</div>

<style>
	/* A few options side by side, one of them chosen: a row in a sunken frame, the chosen one raised. */
	.sdk-choices {
		display: grid;
		/* A column no wider than the choices' room, so a long row of them wraps (in a popup, say). */
		grid-template-columns: minmax(0, 1fr);
		gap: 6px;
	}

	.sdk-choices-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--sdk-dim, #d6ccd2);
	}

	.sdk-choices-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		width: max-content;
		max-width: 100%;
	}

	/* More options than a row holds: a grid of five, the first over the rest where it is the odd one. */
	.sdk-choices-row[data-grid] {
		display: grid;
		grid-template-columns: repeat(var(--sdk-columns, 5), minmax(44px, 1fr));
	}

	.sdk-choices-row[data-lead] > :first-child {
		grid-column: 1 / -1;
	}

	/* Each choice a pill of glass; the one chosen solid, as the bar's play button is. */
	.sdk-choice {
		min-width: 44px;
		min-height: 40px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--sdk-radius, 999px);
		background: rgb(255 255 255 / 0.08);
		color: var(--sdk-ink, #f4f1f2);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.sdk-choice:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.16);
	}

	.sdk-choice:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sdk-choice[aria-checked="true"] {
		background: var(--sdk-main, #f4f1f2);
		color: var(--sdk-on-main, #25191c);
	}

	.sdk-choice:focus-visible {
		outline: 2px solid var(--sdk-accent, #d49791);
		outline-offset: 2px;
	}
</style>
