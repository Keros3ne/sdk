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
