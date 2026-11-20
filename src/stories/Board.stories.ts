/**
 * Stories of the board of reels: five by three as most slots are, a taller grid, and with
 * nothing moving, as it is played with reduced motion or at its quickest.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BoardStory from "./BoardStory.svelte";

const meta = {
	title: "Board of reels",
	component: BoardStory
} satisfies Meta<typeof BoardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveByThree: Story = {};

export const SixByFive: Story = { args: { reels: 6, rows: 5 } };

export const WithNothingMoving: Story = { args: { instant: true } };
