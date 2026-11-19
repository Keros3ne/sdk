<!--
Game Title's reels on their stage, in a square frame as large as the room it is given.
Both views show it; where it goes in each is the view's.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { Stage } from "@keros3ne/sdk/pixi";
	import { REELS, ROWS } from "../../maths/rules";
	import Reels from "./Reels.svelte";
	import { PICTURES } from "./symbols.ts";

	interface Props {
		/** With nothing moving: the player has asked their device for less motion. */
		still: boolean;
		/** Follows the stage as it loads: a loading screen's `track`. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the stage is ready to be played on. */
		onready?: () => void;
	}

	let { still, track, onready }: Props = $props();

	/** A cell's size on the stage, in the stage's own measure. */
	const CELL = 200;
</script>

<!-- The reels, drawn. What they show is said in words by the view, for a screen reader. -->
<div class="room">
	<div class="reels">
		<Stage
			width={REELS * CELL}
			height={ROWS * CELL}
			pictures={PICTURES}
			{track}
			onready={() => onready?.()}
		>
			<Reels cell={CELL} {still} />
		</Stage>
	</div>
</div>

<style>
	/* The room the view gives, measured, so the reels can be as large a square as fits. */
	.room {
		container-type: size;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	/* Square, as large as fits the room either way. The stage in it is drawn by the SDK. */
	.reels {
		width: min(100cqw, 100cqh);
		padding: 1.5%;
		border-radius: 12px;
		background: rgb(15 37 48 / 0.7);
		box-shadow: inset 0 0 0 2px #3b6577;
	}
</style>
