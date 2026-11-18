<!--
A menu button that opens a list of options: a select the game draws itself. It follows the
listbox pattern, so it works with a keyboard (arrows, Home, End, Enter, Escape, and typing
the first letter) and is announced by a screen reader as a choice of options with its
label. `bind:value` is the option chosen.

The open list is kept inside the game: the frame, or the element marked `data-sdk-bounds`.
It is slid sideways as far as it must be, opens the other way where the way asked has no
room, and shows eight options at most: a longer list scrolls.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts" module>
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	/** The most options a menu's list shows at once; more scroll. */
	const MENU_ROWS = 8;
</script>

<script lang="ts" generics="Value extends string | number">
	import { flushSync } from "svelte";
	import type { MenuOption } from "../ui.ts";

	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		options: MenuOption<Value>[];
		value: Value;
		/** Which way the list opens. Up, left out, for controls along the foot of a game. */
		opens?: "up" | "down";
		disabled?: boolean;
		onchange?: (value: Value) => void;
	}

	let {
		look,
		label,
		options,
		value = $bindable(),
		opens = "up",
		disabled = false,
		onchange
	}: Props = $props();

	// The same on a server and in the browser that takes its page over.
	const uid = $props.id();
	const id = `sdk-menu-${uid}`;
	let element = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();
	let list = $state<HTMLElement>();

	let open = $state(false);
	let active = $state(0);
	/** The way the list is open now, which may not be the way asked. */
	let way = $state<"up" | "down">();

	const selected = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);

	/** The option's element, by its place in the list. */
	const item = (index: number) => list?.children[index] as HTMLElement | undefined;

	/** Moves the keys' place in the list, going round at either end, and keeps it in view. */
	function highlight(index: number) {
		active = (index + options.length) % options.length;
		flushSync();
		item(active)?.scrollIntoView({ block: "nearest" });
	}

	/** Keeps the open list inside the game, and no taller than the room it opens into. */
	function place() {
		if (!element || !button || !list) return;

		const bounds = element.closest("[data-sdk-bounds]");
		const { left, right, top, bottom } = bounds
			? bounds.getBoundingClientRect()
			: {
					left: 0,
					right: document.documentElement.clientWidth,
					top: 0,
					bottom: document.documentElement.clientHeight
				};
		const margin = 6;
		const from = button.getBoundingClientRect();

		// Eight options tall, with the list's own padding and edges.
		const style = getComputedStyle(list);
		const frame =
			parseFloat(style.paddingTop) +
			parseFloat(style.paddingBottom) +
			parseFloat(style.borderTopWidth) +
			parseFloat(style.borderBottomWidth);
		const row = item(0)?.offsetHeight ?? 36;
		const eight = row * MENU_ROWS + frame;
		const whole = row * Math.min(options.length, MENU_ROWS) + frame + margin * 2;

		// The way asked, unless it has no room for the whole list and the other way has more.
		const above = from.top - top;
		const below = bottom - from.bottom;
		const [want, other] = opens === "down" ? [below, above] : [above, below];
		const flip = want < whole && other > want;

		way = flip ? (opens === "down" ? "up" : "down") : opens;
		flushSync();

		const room = flip ? other : want;
		list.style.maxHeight = `${Math.floor(Math.min(eight, Math.max(120, room - margin * 2)))}px`;
		list.style.setProperty("--sdk-shift", "0px");

		const box = list.getBoundingClientRect();
		let shift = 0;
		if (box.right > right - margin) shift = right - margin - box.right;
		if (box.left + shift < left + margin) shift = left + margin - box.left;
		list.style.setProperty("--sdk-shift", `${Math.round(shift)}px`);
	}

	/** Opens or closes the list. Closing puts the keyboard back on the button unless told not to. */
	function setOpen(next: boolean, returnFocus = true) {
		if (open === next) return;

		open = next;
		if (open) active = selected;
		flushSync();

		if (open) {
			place();
			item(active)?.scrollIntoView({ block: "nearest" });
			list?.focus();
		} else if (returnFocus) button?.focus();
	}

	/** Chooses an option and closes the list. */
	function choose(index: number) {
		const changed = index !== selected;

		value = options[index].value;
		setOpen(false);
		if (changed) onchange?.(value);
	}

	/** The keys in the open list: the listbox pattern. */
	function onlistkeydown(event: KeyboardEvent) {
		if (event.key === "ArrowDown") highlight(active + 1);
		else if (event.key === "ArrowUp") highlight(active - 1);
		else if (event.key === "Home") highlight(0);
		else if (event.key === "End") highlight(options.length - 1);
		else if (event.key === "Enter" || event.key === " ") choose(active);
		else if (event.key === "Escape") setOpen(false);
		else if (event.key === "Tab") return setOpen(false, false);
		else if (event.key.length === 1) {
			// Typing a character moves to the next option that starts with it.
			const typed = event.key.toLowerCase();
			const from = active + 1;
			const found = options.findIndex((_, index) =>
				options[(from + index) % options.length].label
					.toLowerCase()
					.startsWith(typed)
			);
			if (found >= 0) highlight(from + found);

			return;
		} else return;

		event.preventDefault();
		event.stopPropagation();
	}

	/** Closes the list if it is open, leaving the keyboard where it is. */
	export function close() {
		setOpen(false, false);
	}

	// A menu that can no longer be used is closed.
	$effect(() => {
		if (disabled) setOpen(false, false);
	});
</script>

<div
	class="sdk-menu"
	{@attach dress(() => controlProperties(look))}
	data-opens={way ?? opens}
	bind:this={element}
>
	<span class="sdk-menu-label" id="{id}-label">{label}</span><button
		type="button"
		class="sdk-menu-button"
		id="{id}-button"
		bind:this={button}
		aria-haspopup="listbox"
		aria-expanded={String(open) as "true" | "false"}
		aria-labelledby="{id}-label {id}-button"
		{disabled}
		onclick={() => setOpen(!open)}
		onkeydown={(event) => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				setOpen(true);
			}
		}}
	>
		{options[selected].label}
	</button>
	<ul
		class="sdk-menu-list"
		id="{id}-list"
		bind:this={list}
		tabindex="-1"
		hidden={!open}
		role="listbox"
		aria-labelledby="{id}-label"
		aria-activedescendant="{id}-option-{active}"
		onkeydown={onlistkeydown}
		onfocusout={(event) => {
			// A press anywhere else, or focus leaving, closes the list.
			if (!element?.contains(event.relatedTarget as Node | null))
				setOpen(false, false);
		}}
	>
		{#each options as option, index}<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				class={["sdk-menu-option", { "sdk-active": open && index === active }]}
				id="{id}-option-{index}"
				role="option"
				aria-selected={String(index === selected) as "true" | "false"}
				onclick={() => choose(index)}
				onpointermove={() => highlight(index)}
			>
				{option.label}
			</li>{/each}
	</ul>
</div>
