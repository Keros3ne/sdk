/**
 * The dev page, started: asks the dev server how things stand, and puts the page in.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import { mount } from "svelte";
import DevPage from "./DevPage.svelte";

const start = await (await fetch("/api/state")).json();

mount(DevPage, { target: document.getElementById("host")!, props: { start } });
