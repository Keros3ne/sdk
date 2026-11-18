<!--
A button for inside a popup or a menu: a line that does something, with room for a second
line saying what it costs or does.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	interface Props {
		label: string;
		/** A line under the label saying more. */
		detail?: string;
		disabled?: boolean;
		onpress: () => void;
	}

	let { label, detail, disabled = false, onpress }: Props = $props();
</script>

<button type="button" class="sdk-action" {disabled} onclick={() => onpress()}>
	<span>{label}</span>{#if detail}<span class="sdk-detail">{detail}</span>{/if}
</button>
