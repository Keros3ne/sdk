<!--
A game's wide view: 16 by 10, drawn at 1600 by 1000. Every game has one.

A studio writes its own `WideView.svelte`, puts this round what it draws, and places its
components inside in the view's own pixels, passing each what differs between the two
views as props. Which view is shown is not the game's to say (the engine's `Views`).

    <WideView>
      <Reels x={520} y={90} size={820} {game} />
      <ControlBar {...game.bar} />
    </WideView>

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import View from "./View.svelte";

	let { children }: { children: Snippet } = $props();
</script>

<View shape="wide">{@render children()}</View>
