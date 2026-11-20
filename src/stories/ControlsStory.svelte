<!--
The SDK's controls by themselves, outside a control bar, for their stories: each as a game
would write it among its own options, with what the player last did written above it.

Author: dwclake
Created: 2026-11-20
-->
<script lang="ts">
	import {
		Action,
		Autoplay,
		Choices,
		Field,
		Menu,
		Popup,
		Slider,
		Switch
	} from "../controls/index.ts";
	import type { ControlLook } from "../look.ts";
	import "../ui.css";

	/** The controls there are a story of. */
	type Control =
		| "menu"
		| "field"
		| "switch"
		| "slider"
		| "choices"
		| "grid"
		| "action"
		| "popup"
		| "autoplay";

	interface Props {
		/** The control shown. */
		show?: Control;
		/** As while a round is played: it cannot be changed. */
		disabled?: boolean;
		/** A studio's own colour for what is chosen, switched on or in focus. The SDK's, left out. */
		accent?: string;
	}

	let { show = "menu", disabled = false, accent }: Props = $props();

	const look = $derived<ControlLook | undefined>(accent ? { accent } : undefined);

	let said = $state("Nothing pressed yet.");
	let rows = $state(8);
	let target = $state("2.00");
	let sound = $state(true);
	let volume = $state(0.6);
	let risk = $state("medium");
	let bet = $state(100);
	let left = $state(0);

	const RISKS = [
		{ value: "low", label: "Low" },
		{ value: "medium", label: "Medium" },
		{ value: "high", label: "High" }
	];
	const BETS = Array.from({ length: 40 }, (_, index) => ({
		value: (index + 1) * 20,
		label: ((index + 1) / 5).toFixed(2)
	}));
</script>

<div class="room">
	<p class="said" aria-live="polite">{said}</p>
	<div class="stand">
		{#if show === "menu"}
			<Menu
				{look}
				label="Rows"
				opens="down"
				options={[8, 9, 10, 11, 12, 13, 14, 15, 16].map((value) => ({
					value,
					label: String(value)
				}))}
				bind:value={rows}
				{disabled}
				onchange={(value) => (said = `Rows: ${value}.`)}
			/>
		{:else if show === "field"}
			<Field
				{look}
				label="Target multiplier"
				inputMode="decimal"
				bind:value={target}
				note={Number(target) >= 1.01 ? `Pays ${target}x` : "At least 1.01"}
				{disabled}
				oninput={(value) => (said = `Target: ${value}.`)}
			/>
		{:else if show === "switch"}
			<Switch
				{look}
				label="Sound effects"
				detail="Wins, spins and buttons"
				bind:checked={sound}
				{disabled}
				onchange={(on) => (said = `Sound ${on ? "on" : "off"}.`)}
			/>
		{:else if show === "slider"}
			<Slider
				{look}
				label="Volume"
				bind:value={volume}
				step={0.1}
				{disabled}
				onchange={(value) => (said = `Volume: ${Math.round(value * 100)}%.`)}
			/>
		{:else if show === "choices"}
			<Choices
				{look}
				label="Risk"
				options={RISKS}
				bind:value={risk}
				{disabled}
				onchange={(value) => (said = `Risk: ${value}.`)}
			/>
		{:else if show === "grid"}
			<Choices
				{look}
				label="Bet"
				grid={4}
				options={BETS}
				bind:value={bet}
				maxHeight={232}
				figures
				{disabled}
				onchange={(value) => (said = `Bet: ${(value / 100).toFixed(2)}.`)}
			/>
		{:else if show === "action"}
			<Action
				{look}
				label="Rules"
				detail="How the game pays"
				{disabled}
				onpress={() => (said = "Rules pressed.")}
			/>
		{:else if show === "popup"}
			<Popup {look} label="Options" opens="down" {disabled}>
				<Switch
					{look}
					label="Sound effects"
					bind:checked={sound}
					onchange={(on) => (said = `Sound ${on ? "on" : "off"}.`)}
				/>
				<Action
					{look}
					label="Rules"
					detail="How the game pays"
					onpress={() => (said = "Rules pressed.")}
				/>
			</Popup>
		{:else}
			<Autoplay
				{look}
				counts={[10, 25, 50, 100]}
				noun={["spin", "spins"]}
				opens="down"
				{left}
				{disabled}
				onstart={(count) => {
					left = count;
					said = `Autoplay started: ${count} spins.`;
				}}
				onstop={() => {
					left = 0;
					said = "Autoplay stopped.";
				}}
			/>
		{/if}
	</div>
</div>

<style>
	.room {
		display: grid;
		gap: 24px;
		align-content: start;
		min-height: 420px;
		padding: 24px;
		background: #17181a;
		color: #f2f2f2;
		font:
			500 15px/1.3 "Geist Variable",
			ui-sans-serif,
			system-ui,
			sans-serif;
	}

	.said {
		margin: 0;
	}

	.stand {
		justify-self: start;
		min-width: 260px;
	}
</style>
