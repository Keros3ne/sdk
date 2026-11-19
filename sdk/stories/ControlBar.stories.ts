/**
 * Stories of the SDK's control bar: as it is left alone, while a round is shown, with
 * autoplay and free spins running, on a narrow game, stained, and as a studio may set it.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Meta, StoryObj } from "@storybook/svelte-vite";
import ControlBarStory from "./ControlBarStory.svelte";

const meta = {
	title: "Control bar",
	component: ControlBarStory,
	argTypes: {
		speeds: { control: "inline-radio", options: ["turbo", "fast", "none"] },
		place: { control: "inline-radio", options: ["bottom", "top"] },
		freeSpins: { control: "number" },
		autoLeft: { control: "number" },
		tint: { control: "color" }
	}
} satisfies Meta<typeof ControlBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const narrow = { width: 390, height: 693 };

export const LeftAlone: Story = {};

export const WhileARoundIsShown: Story = { args: { busy: true } };

export const AutoplayRunning: Story = { args: { autoLeft: 18 } };

export const FreeSpinsRunning: Story = { args: { freeSpins: 8 } };

export const OnANarrowGame: Story = { args: narrow };

export const Stained: Story = { args: { tint: "#d49791" } };

export const StainedOnANarrowGame: Story = { args: { tint: "#6a3df0", ...narrow } };

export const WithoutAutoplay: Story = { args: { autoplay: false, speeds: "none" } };

export const ATypedBet: Story = { args: { typed: true } };

export const AlongTheTopAndBigger: Story = {
	args: { place: "top", scale: 1.25, hide: ["menu"] }
};
