<!--
A field to type a value in, such as a target multiplier: underlined, as the site's own
fields are, the line turning to the accent while it is typed in. `inputMode` brings up the
right keyboard on a phone. `bind:value` is what is typed, and `note` a line under it: what
the value means, or what is wrong with it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	interface Props {
		label: string;
		value: string;
		inputMode?: "decimal" | "numeric" | "text";
		/** A line under it. Empty for none. */
		note?: string;
		disabled?: boolean;
		oninput?: (value: string) => void;
	}

	let {
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

<label class="sdk-field">
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
