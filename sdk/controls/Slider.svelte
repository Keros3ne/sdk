<!--
An amount between two ends, set by dragging a knob along a track: a slider the game
draws, in place of a range input. It follows the slider pattern: the arrow keys move it a
step, Page Up and Page Down a larger one, Home and End go to the ends, and a screen
reader is told its value.

Left alone it goes from nothing to all, 0 to 1, and reads as a percentage (or "Off"), as
the volume does. `min`, `max` and `step` set its range in a game's own units, and `format`
how its value reads. `bind:value` is where it is.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { controlProperties, dress, type ControlLook } from "../look.ts";
	interface Props {
		/** How it looks: its colours and corners (../look.ts). Left out, as the site draws it. */
		look?: ControlLook;
		label: string;
		value: number;
		min?: number;
		max?: number;
		/** How far an arrow key moves it. A twentieth of the range, left out. */
		step?: number;
		/** How the value reads, beside the label and to a screen reader. */
		format?: (value: number) => string;
		/** While a round is played: it cannot be moved. */
		disabled?: boolean;
		onchange?: (value: number) => void;
	}

	let {
		look,
		label,
		value = $bindable(),
		min: lowest,
		max: highest,
		step: asked,
		format: reads,
		disabled = false,
		onchange
	}: Props = $props();

	// The same on a server and in the browser that takes its page over.
	const uid = $props.id();
	const id = `sdk-slider-${uid}`;
	const min = $derived(lowest ?? 0);
	const max = $derived(highest ?? 1);
	const step = $derived(asked ?? (max - min) / 20);
	// A slider left alone is told to a screen reader in percent, as it always was.
	const percent = $derived(lowest === undefined && highest === undefined);

	let track = $state<HTMLElement>();
	let knob = $state<HTMLElement>();

	const clamp = (next: number) => Math.min(max, Math.max(min, next));
	const at = $derived(clamp(value));
	const share = $derived((at - min) / (max - min));

	/** How a value reads: as the game says, or as a share of the whole. */
	function format(amount: number): string {
		if (reads) return reads(amount);

		const whole = Math.round(((amount - min) / (max - min)) * 100);

		return whole === 0 ? "Off" : `${whole}%`;
	}

	/** Moves it, kept to whole steps from the start, so that the keys and a drag land on the same values. */
	function set(next: number) {
		if (disabled) return;

		const snapped = clamp(min + Math.round((next - min) / step) * step);
		const rounded = Math.round(snapped * 1e6) / 1e6;
		if (rounded === at) return;

		value = rounded;
		onchange?.(rounded);
	}

	/** The value under a pointer: the knob's middle travels from one end of the track to the other. */
	function under(event: PointerEvent): number {
		const box = track!.getBoundingClientRect();
		const inset = (knob?.offsetWidth ?? 0) / 2;
		const along =
			(event.clientX - box.left - inset) / Math.max(1, box.width - inset * 2);

		return min + along * (max - min);
	}

	/** The keys move it by a step, by four, or to an end. */
	function onkeydown(event: KeyboardEvent) {
		if (event.key === "ArrowRight" || event.key === "ArrowUp") set(at + step);
		else if (event.key === "ArrowLeft" || event.key === "ArrowDown") set(at - step);
		else if (event.key === "PageUp") set(at + step * 4);
		else if (event.key === "PageDown") set(at - step * 4);
		else if (event.key === "Home") set(min);
		else if (event.key === "End") set(max);
		else return;

		event.preventDefault();
	}

	/** A press on the track takes the knob there, and holds the pointer for the drag. */
	function onpointerdown(event: PointerEvent) {
		if (disabled) return;

		track!.setPointerCapture(event.pointerId);
		track!.focus({ preventScroll: true });
		set(under(event));
		event.preventDefault();
	}
</script>

<div
	class={["sdk-slider", { "sdk-disabled": disabled }]}
	{@attach dress(() => controlProperties(look))}
>
	<div class="sdk-slider-heading">
		<span class="sdk-slider-label" id="{id}-label">{label}</span><span
			class="sdk-slider-amount"
			aria-hidden="true"
		>
			{format(at)}
		</span>
	</div>
	<div
		class="sdk-slider-track"
		bind:this={track}
		tabindex={disabled ? -1 : 0}
		role="slider"
		aria-labelledby="{id}-label"
		aria-valuemin={percent ? 0 : min}
		aria-valuemax={percent ? 100 : max}
		aria-valuenow={percent ? Math.round(share * 100) : at}
		aria-valuetext={format(at)}
		aria-disabled={disabled ? "true" : undefined}
		style:--sdk-at-share={share}
		{onkeydown}
		{onpointerdown}
		onpointermove={(event) => {
			if (track!.hasPointerCapture(event.pointerId)) set(under(event));
		}}
	>
		<span class="sdk-slider-knob" bind:this={knob}></span>
	</div>
</div>
