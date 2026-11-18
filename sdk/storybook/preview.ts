/**
 * How every story is shown in the SDK's Storybook: on the ground a game is played on, and
 * filling the room it has, as a game's client fills its frame.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Preview } from "@storybook/svelte-vite";
import "./preview.css";

const preview: Preview = {
	parameters: {
		layout: "fullscreen",
		controls: { expanded: true }
	}
};

export default preview;
