<!--
A game's tall view: 9 by 16, drawn at 900 by 1600. A game drawn for a phone has one too; without it, a game is shown wide everywhere.

A studio writes its own `TallView.svelte`, puts this round what it draws, and places its
components inside in the view's own pixels, passing each what differs between the two
views as props. Which view is shown is not the game's to say (the engine's `Views`).

    <TallView>
      <Reels x={520} y={90} size={820} {game} />
      <ControlBar {...game.bar} />
    </TallView>

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import View from "./View.svelte";

	let { children }: { children: Snippet } = $props();
</script>

<View shape="tall">{@render children()}</View>
