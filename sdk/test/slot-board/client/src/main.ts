/**
 * The SDK's shared slot pieces, on a page of their own, played from a round's events:
 * `e2e/slot-board.e2e.ts` opens it, served under the policy a studio game's client is.
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
