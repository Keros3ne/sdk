/**
 * Stories of the control bar: as it is left alone, while a round is shown, with free spins
 * running, on a narrow game, and laid out as a studio may lay it out.
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
		freeSpins: { control: "number" }
	}
} satisfies Meta<typeof ControlBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LeftAlone: Story = {};

export const WhileARoundIsShown: Story = { args: { busy: true } };

export const FreeSpinsRunning: Story = { args: { freeSpins: 8 } };

export const OnANarrowGame: Story = { args: { width: 360 } };

export const WithoutAutoplay: Story = { args: { autoplay: false, speeds: "none" } };

export const FloatingAndBigger: Story = {
	args: { layout: { place: "float", at: { x: 0.5, y: 0.5 }, scale: 1.25 } }
};

export const NarrowerAtOneSide: Story = {
	args: { layout: { width: 0.7, align: "start", hide: ["menu"] } }
};
