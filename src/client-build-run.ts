/**
 * Builds the client in the folder this is run in: SvelteKit builds the folder it is run
 * in, and nowhere else, so ./client-build.ts runs this there for each client.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */
import { createBuilder } from "vite";
import { clientConfig, finishClient } from "./client-build.ts";

const client = process.cwd();

// The whole app: the page as it is rendered here, and the code a browser is sent.
const builder = await createBuilder(clientConfig(client));
await builder.buildApp();
finishClient(client);
