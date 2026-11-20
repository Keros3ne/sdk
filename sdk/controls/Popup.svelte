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
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	import { flushSync, type Snippet } from "svelte";

	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
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
		look,
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
	{@attach dress(() => controlProperties(look))}
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

<style>
	/*
	 * A popup: a button, and a panel that opens over the game from it. The panel
	 * is centred on its button and then slid sideways by --sdk-shift, which the
	 * script sets so that it stays inside the frame.
	 */
	.sdk-popup {
		position: relative;
		display: inline-flex;
	}

	:where(.sdk-popup-button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid var(--sdk-line, #42363b);
		border-radius: var(--sdk-radius, 999px);
		background: var(--sdk-surface, #2f232b);
		color: var(--sdk-ink, #f4f1f2);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}

	:where(.sdk-popup-button):disabled {
		opacity: 0.45;
		cursor: default;
	}

	:where(.sdk-popup-button)[aria-expanded="true"] {
		border-color: var(--sdk-accent, #d49791);
		color: var(--sdk-accent, #d49791);
	}

	.sdk-popup-panel {
		position: absolute;
		z-index: 20;
		left: 50%;
		bottom: calc(100% + 8px);
		transform: translateX(calc(-50% + var(--sdk-shift, 0px)));
		display: grid;
		gap: 6px;
		width: max-content;
		max-width: min(300px, calc(100vw - 12px));
		padding: 12px;
		border: 1px solid var(--sdk-line, rgb(255 255 255 / 0.22));
		border-radius: 22px;
		/* Glass, as the bar is: what is behind shows through, blurred. */
		background: var(--sdk-surface, rgb(26 19 24 / 0.82));
		backdrop-filter: blur(22px) saturate(1.25);
		color: var(--sdk-ink, #f4f1f2);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.2),
			0 14px 36px rgb(0 0 0 / 0.45);
		font-weight: 500;
		text-align: left;
	}

	/* What is in a popup may be no wider than it, so a long row of choices wraps rather than running out of it. */
	.sdk-popup-panel > :global(*) {
		min-width: 0;
	}

	.sdk-popup[data-opens="down"] .sdk-popup-panel {
		top: calc(100% + 8px);
		bottom: auto;
	}

	.sdk-popup-panel:focus {
		outline: none;
	}

	:where(.sdk-popup-button):focus-visible {
		outline: 2px solid var(--sdk-accent, #d49791);
		outline-offset: 2px;
	}
</style>
