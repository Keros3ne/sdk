<!--
A field to type a value in, such as a target multiplier: underlined, as the site's own
fields are, the line turning to the accent while it is typed in. `inputMode` brings up the
right keyboard on a phone. `bind:value` is what is typed, and `note` a line under it: what
the value means, or what is wrong with it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		value: string;
		inputMode?: "decimal" | "numeric" | "text";
		/** A line under it. Empty for none. */
		note?: string;
		disabled?: boolean;
		oninput?: (value: string) => void;
	}

	let {
		look,
		label,
		value = $bindable(),
		inputMode = "text",
		note = "",
		disabled = false,
		oninput
	}: Props = $props();

	// The same on a server and in the browser that takes its page over.
	const uid = $props.id();
	const id = `sdk-field-${uid}`;
	let input = $state<HTMLInputElement>();

	// What is typed is the field's own. It is written to only when the value is changed from
	// outside to something other than what the field holds: written at each change, a field
	// being typed in is put back to what it held before.
	$effect(() => {
		if (input && input.value !== value) input.value = value;
	});
</script>

<label class="sdk-field" {@attach dress(() => controlProperties(look))}>
	<span class="sdk-field-label">{label}</span><input
		class="sdk-field-input"
		bind:this={input}
		inputmode={inputMode}
		autocomplete="off"
		aria-describedby="{id}-note"
		{disabled}
		oninput={(event) => {
			value = event.currentTarget.value;
			oninput?.(value);
		}}
	/><small class="sdk-field-note" id="{id}-note">{note}</small>
</label>

<style>
	/* A field to type in: underlined, as the site's are, the line turning to the accent while typing. */
	.sdk-field {
		display: inline-grid;
		gap: 6px;
	}

	.sdk-field-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--sdk-dim, #d6ccd2);
	}

	.sdk-field-input {
		min-height: 44px;
		padding: 0 2px;
		border: 0;
		border-bottom: 1px solid var(--sdk-line, #53474e);
		border-radius: 0;
		background: transparent;
		color: var(--sdk-ink, #f4f1f2);
		font: inherit;
		font-variant-numeric: tabular-nums;
	}

	.sdk-field-input:focus {
		outline: none;
		border-bottom-color: var(--sdk-accent, #d49791);
		box-shadow: 0 1px 0 0 var(--sdk-accent, #d49791);
	}

	.sdk-field-input:disabled {
		opacity: 0.45;
	}

	.sdk-field-note {
		min-height: 1.2em;
		font-size: 12px;
		color: var(--sdk-dim, #d6ccd2);
	}
</style>
