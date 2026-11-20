/**
 * A round from the studio's real books: the story every studio has without writing one.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BooksStory from "./BooksStory.svelte";

const meta = {
	title: "Books",
	component: BooksStory
} satisfies Meta<typeof BooksStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ARoundFromTheBooks: Story = {};
