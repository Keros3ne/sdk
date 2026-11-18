/**
 * Harbour Lights' stories: the whole game played from its real book, a spin of any kind
 * and one that pays.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { Meta, StoryObj } from "@keros3ne/studio-sdk/stories";
import GameStory from "./GameStory.svelte";

const meta = {
	title: "Harbour Lights/The game",
	component: GameStory
} satisfies Meta<typeof GameStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ASpinFromTheBook: Story = {};

export const ASpinThatPays: Story = { args: { winning: true } };
