<!--
Something that is on or off: a switch the game draws, in place of a checkbox. It is a
button with the switch role, so Space and Enter turn it and a screen reader says which
way it is. `bind:checked` is which way.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		/** A line under the label saying what it does or costs. */
		detail?: string;
		checked?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let {
		look,
		label,
		detail,
		checked = $bindable(false),
		disabled = false,
		onchange
	}: Props = $props();

	/** Turns it the other way, and says so. */
	function turn() {
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	type="button"
	class="sdk-switch"
	{@attach dress(() => controlProperties(look))}
	role="switch"
	aria-checked={String(checked) as "true" | "false"}
	{disabled}
	onclick={turn}
>
	<span class="sdk-switch-text">
		<span class="sdk-switch-label">{label}</span>{#if detail}<span class="sdk-detail">
				{detail}
			</span>{/if}
	</span><span class="sdk-switch-track" aria-hidden="true"></span>
</button>

<style>
	/* A switch: its words, then a track with a knob that slides across when it is on. */
	.sdk-switch {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 40px;
		padding: 0 4px;
		border: 0;
		border-radius: 14px;
		background: none;
		color: var(--sdk-ink, #f2f2f2);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	:global(.sdk-popup-panel) .sdk-switch {
		width: 100%;
		min-height: 44px;
		padding: 6px 12px;
		background: rgb(255 255 255 / 0.05);
	}

	.sdk-switch-track {
		position: relative;
		flex: none;
		width: 40px;
		height: 24px;
		border: 1px solid var(--sdk-line, #4c4e53);
		border-radius: 999px;
		background: transparent;
	}

	.sdk-switch-track::after {
		content: "";
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--sdk-dim, #b4b6ba);
		transition: transform 120ms;
	}

	.sdk-switch[aria-checked="true"] .sdk-switch-track {
		border-color: var(--sdk-accent, #8ab4f8);
		background: var(--sdk-accent, #8ab4f8);
	}

	.sdk-switch[aria-checked="true"] .sdk-switch-track::after {
		transform: translateX(16px);
		background: var(--sdk-on-accent, #17181a);
	}

	.sdk-switch:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sdk-switch:focus-visible {
		outline: 2px solid var(--sdk-accent, #8ab4f8);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.sdk-switch-track::after {
			transition: none;
		}
	}
</style>
