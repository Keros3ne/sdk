/**
 * Stories of the SDK's controls by themselves, as a game writes them among its own
 * options outside the control bar: a menu, a field, a switch, a slider, a row and a grid of
 * choices, an action, a popup and autoplay; each as it is left alone, while a round is
 * played, and in a studio's own colour.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import type { Meta, StoryObj } from "@storybook/svelte-vite";
import ControlsStory from "./ControlsStory.svelte";

const meta = {
	title: "Controls",
	component: ControlsStory,
	argTypes: {
		show: {
			control: "select",
			options: [
				"menu",
				"field",
				"switch",
				"slider",
				"choices",
				"grid",
				"action",
				"popup",
				"autoplay"
			]
		},
		accent: { control: "color" }
	}
} satisfies Meta<typeof ControlsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AMenu: Story = { args: { show: "menu" } };

export const AField: Story = { args: { show: "field" } };

export const ASwitch: Story = { args: { show: "switch" } };

export const ASlider: Story = { args: { show: "slider" } };

export const ARowOfChoices: Story = { args: { show: "choices" } };

export const AGridOfFigures: Story = { args: { show: "grid" } };

export const AnAction: Story = { args: { show: "action" } };

export const APopup: Story = { args: { show: "popup" } };

export const AutoplayByItself: Story = { args: { show: "autoplay" } };

export const WhileARoundIsPlayed: Story = { args: { show: "choices", disabled: true } };

export const InAStudiosColour: Story = { args: { show: "switch", accent: "#f5c451" } };
