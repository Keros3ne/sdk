/**
 * How Storybook builds what it shows: the SDK's own, as a client's build is
 * (../client-build.ts). A studio brings no build configuration of its own here either.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })]
});
