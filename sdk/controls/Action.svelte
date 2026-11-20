<!--
A button for inside a popup or a menu: a line that does something, with room for a second
line saying what it costs or does.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		/** A line under the label saying more. */
		detail?: string;
		disabled?: boolean;
		onpress: () => void;
	}

	let { look, label, detail, disabled = false, onpress }: Props = $props();
</script>

<button
	type="button"
	class="sdk-action"
	{@attach dress(() => controlProperties(look))}
	{disabled}
	onclick={() => onpress()}
>
	<span>{label}</span>{#if detail}<span class="sdk-detail">{detail}</span>{/if}
</button>

<style>
	/* A line in a popup that does something. */
	.sdk-action {
		display: block;
		width: 100%;
		min-height: 44px;
		padding: 6px 12px;
		border: 1px solid transparent;
		border-radius: 14px;
		background: rgb(255 255 255 / 0.05);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.sdk-action:hover:not(:disabled) {
		border-color: var(--sdk-line, #3b3d42);
	}

	.sdk-action:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sdk-action:focus-visible {
		outline: 2px solid var(--sdk-accent, #8ab4f8);
		outline-offset: 2px;
	}
</style>
