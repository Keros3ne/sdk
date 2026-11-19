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
