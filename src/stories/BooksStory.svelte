<!--
A round played from a studio's real books, as the site would play it: every row drawn,
with the events that play it out, and the choice where the round stops at one. It shows a
studio what its books hold before any of its client is drawn.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import {
		gamesWithBooks,
		roundFromBooks,
		type StoryGames,
		type StoryRound
	} from "../stories.ts";

	/** The game and mode to open with. The studio's first game and its ordinary mode, left out. */
	let { slug, mode }: { slug?: string; mode?: string } = $props();

	let games = $state.raw<StoryGames["games"]>([]);
	let chosenGame = $state<string>();
	let chosenMode = $state<string>();
	let round = $state.raw<StoryRound>();
	let choices = $state<string[]>([]);
	let problem = $state("");

	const game = $derived(
		games.find((each) => each.slug === (chosenGame ?? slug)) ?? games[0]
	);
	const modeId = $derived(chosenMode ?? mode ?? game?.modes[0]?.id);

	/** Asks for the round, from the start or with one more choice made. */
	async function play(seed?: string) {
		if (!game) return;

		try {
			problem = "";
			round = await roundFromBooks({
				slug: game.slug,
				mode: modeId,
				choices,
				seed
			});
		} catch (error) {
			problem = error instanceof Error ? error.message : String(error);
		}
	}

	/** A new round, nothing chosen in it yet. */
	function draw() {
		choices = [];
		void play();
	}

	/** Picks an option of the choice the round stopped at, and plays on. */
	function choose(option: string) {
		choices = [...choices, option];
		void play(round?.seed);
	}

	/** The studio's games, asked for once the story is on the page. */
	function load() {
		gamesWithBooks().then(
			(answer) => (games = answer.games),
			(error) => (problem = error instanceof Error ? error.message : String(error))
		);
	}
</script>

<div class="books" {@attach load}>
	<p class="row">
		<label>
			Game
			<select bind:value={chosenGame}>
				{#each games as each (each.slug)}<option value={each.slug}>
						{each.name}
					</option>{/each}
			</select>
		</label>
		<label>
			Mode
			<select bind:value={chosenMode}>
				{#each game?.modes ?? [] as each (each.id)}<option value={each.id}>
						{each.name}
					</option>{/each}
			</select>
		</label>
		<button onclick={draw} disabled={!game}>Draw a round</button>
	</p>

	{#if problem}<p role="alert">{problem}</p>{/if}

	{#if round}
		<p>
			Pays <strong>{(round.view.payoutBp / 10_000).toFixed(2)}</strong> bets
			{round.view.open ? "so far: the round is open." : "in all."}
		</p>

		<ol>
			{#each round.view.steps as step, index (index)}
				<li>
					<strong>{step.table}</strong>, row {step.row}, pays {(
						step.payoutBp / 10_000
					).toFixed(2)}
					{#if step.chosen}(chose {step.chosen}){/if}
					<ul>
						{#each step.events as event, place (place)}
							<li><code>{JSON.stringify(event)}</code></li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>

		{#if round.view.options}
			<p class="row">
				Choose:
				{#each round.view.options as option (option)}
					<button onclick={() => choose(option)}>{option}</button>
				{/each}
			</p>
		{/if}
	{/if}
</div>

<style>
	.books {
		padding: 1rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	code {
		font-size: 0.8rem;
		word-break: break-all;
	}
</style>
