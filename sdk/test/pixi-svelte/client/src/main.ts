/**
 * The SDK's Pixi bindings, on a page of their own: `e2e/pixi-svelte.e2e.ts` opens it,
 * served under the policy a studio game's client is, and holds what it draws.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

// Everything the policy stops is kept, for the test to read.
const stopped: string[] = [];
document.addEventListener("securitypolicyviolation", (event) => {
	stopped.push(`${event.effectiveDirective} ${event.blockedURI}`);
	document.body.dataset.stopped = JSON.stringify(stopped);
});
document.body.dataset.stopped = "[]";

export {};
