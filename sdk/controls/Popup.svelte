<!--
A button that opens a panel above (or below) itself, holding whatever the game puts there:
actions, switches, a choice and a button to confirm it.

It follows the dialog pattern for a popup that is not modal. The button says whether the
panel is open; opening moves focus into the panel; Escape, a press anywhere else, or focus
leaving closes it; and closing puts focus back on the button. The panel is kept inside the
game however near the edge its button is: the frame, or the element marked
`data-sdk-bounds` (the control bar marks its container).

What is written inside this is the panel's contents; `face`, if given, is drawn on the
button in place of its label.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { flushSync, type Snippet } from "svelte";

	interface Props {
		/** What the button says. */
		label: string;
		/** What the panel is called, for a screen reader. The label, left out. */
		title?: string;
		/** Which way the panel opens. Up, left out, for controls along the foot of a game. */
		opens?: "up" | "down";
		disabled?: boolean;
		/** More classes for the popup itself. */
		class?: string;
		/** More classes for the button, and more attributes: a name for a screen reader, say. */
		buttonClass?: string;
		buttonProps?: Record<string, string | undefined>;
		/**
		 * Called when the button is pressed while the panel is closed. Returning false keeps
		 * it closed: for a button that does something else while the game is busy.
		 */
		onpress?: () => boolean | void;
		onopen?: () => void;
		/** Drawn on the button in place of its label. */
		face?: Snippet;
		children?: Snippet;
	}

	let {
		label,
		title,
		opens = "up",
		disabled = false,
		class: popupClass,
		buttonClass,
		buttonProps,
		onpress,
		onopen,
		face,
		children
	}: Props = $props();

	// The same on a server and in the browser that takes its page over.
	const uid = $props.id();
	const id = `sdk-popup-${uid}`;
	let element = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();
	let panel = $state<HTMLElement>();
	let open = $state(false);

	/** Slides the panel sideways so that none of it is outside the game. */
	function place() {
		if (!element || !panel) return;

		panel.style.setProperty("--sdk-shift", "0px");

		const box = panel.getBoundingClientRect();
		const bounds = element.closest("[data-sdk-bounds]");
		const { left, right } = bounds
			? bounds.getBoundingClientRect()
			: { left: 0, right: document.documentElement.clientWidth };
		const margin = 6;
		let shift = 0;
		if (box.right > right - margin) shift = right - margin - box.right;
		if (box.left + shift < left + margin) shift = left + margin - box.left;

		panel.style.setProperty("--sdk-shift", `${Math.round(shift)}px`);
	}

	/** A press anywhere outside closes the panel. */
	function onOutside(event: PointerEvent) {
		if (!element?.contains(event.target as Node | null)) setOpen(false, false);
	}

	/** Opens or closes the panel. Closing puts focus back on the button unless told not to. */
	function setOpen(next: boolean, returnFocus = true) {
		if (open === next) return;

		open = next;
		flushSync();

		if (open) {
			place();
			document.addEventListener("pointerdown", onOutside, true);

			const first = panel?.querySelector<HTMLElement>(
				'button:not(:disabled), [tabindex="0"]'
			);
			(first ?? panel)?.focus({ preventScroll: true });
			onopen?.();
		} else {
			document.removeEventListener("pointerdown", onOutside, true);
			if (returnFocus) button?.focus({ preventScroll: true });
		}
	}

	/** Opens the panel. */
	export function show() {
		setOpen(true);
	}

	/** Closes the panel. Focus goes back to the button unless `returnFocus` is false. */
	export function close(returnFocus = true) {
		setOpen(false, returnFocus);
	}

	/** Whether the panel is open. */
	export const isOpen = (): boolean => open;

	/** The popup's own elements, for whatever has made it and must reach into it. */
	export const parts = () => ({ element: element!, button: button!, panel: panel! });

	// A popup that can no longer be used is closed.
	$effect(() => {
		if (disabled) setOpen(false, false);
	});

	// Gone with its popup, open or not.
	$effect(() => () => document.removeEventListener("pointerdown", onOutside, true));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class={["sdk-popup", popupClass]}
	data-opens={opens}
	bind:this={element}
	onkeydown={(event) => {
		if (event.key !== "Escape" || !open) return;

		event.preventDefault();
		event.stopPropagation();
		setOpen(false);
	}}
	onfocusout={(event) => {
		const to = event.relatedTarget as Node | null;

		// Focus going nowhere is a press on something that cannot hold it, which `onOutside` judges.
		if (to && !element?.contains(to)) setOpen(false, false);
	}}
>
	<button
		type="button"
		class={["sdk-popup-button", buttonClass]}
		bind:this={button}
		aria-haspopup="dialog"
		aria-expanded={String(open) as "true" | "false"}
		aria-controls={id}
		{...buttonProps}
		{disabled}
		onclick={() => {
			if (open) return setOpen(false);
			if (onpress?.() === false) return;

			setOpen(true);
		}}
	>
		{#if face}{@render face()}{:else}{label}{/if}
	</button>
	<div
		class="sdk-popup-panel"
		{id}
		bind:this={panel}
		tabindex="-1"
		hidden={!open}
		role="dialog"
		aria-label={title ?? label}
	>
		{@render children?.()}
	</div>
</div>
