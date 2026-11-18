import { describe, expect, it } from "vitest";
import { MAX_STAKE, MIN_STAKE, settlePayout } from "./bets.ts";
import { createRng, payoutRoll } from "./rng.ts";
import { createStandIn } from "./stand-in.ts";
import { tossup } from "./test/round-game.ts";

describe("the stand-in for the site", () => {
	it("opens a round for the stake, plays its action, and pays as the site settles a payout", () => {
		const site = createStandIn(tossup, { balance: 10_00 });
		const opened = site.open(1_00, { risk: "low" });
		expect(opened.ok && opened.round.open).toBe(true);
		expect(site.balance).toBe(9_00);
		expect(site.fairness.nonce).toBe(1);

		const played = site.act({ pick: "heads" });
		if (!played.ok) throw new Error(played.message);
		expect(played.round.open).toBe(false);
		expect([0, 1_94]).toContain(played.round.payout);
		expect(site.balance).toBe(9_00 + played.round.payout);
		expect(site.round).toBeNull();
		expect(site.history()).toHaveLength(1);
	});

	it("charges the bet times what a way of playing costs, and pays on the bet", () => {
		// Tossup played at three bets a round.
		const dear = { ...tossup, costBp: () => 30_000 };
		const site = createStandIn(dear, { balance: 10_00 });
		const opened = site.open(1_00, { risk: "low" });
		if (!opened.ok) throw new Error(opened.message);
		expect(opened.round).toMatchObject({ stake: 3_00, baseStake: 1_00 });
		expect(site.balance).toBe(7_00);
		const played = site.act({ pick: "heads" });
		if (!played.ok) throw new Error(played.message);
		// A win of 1.94x is of the bet, not of the 3.00 it cost.
		expect([0, 1_94]).toContain(played.round.payout);
		expect(site.balance).toBe(7_00 + played.round.payout);

		// A bet and a quarter at 0.10 would be 12.5 cents: refused, and nothing charged.
		const quarter = createStandIn(
			{ ...tossup, costBp: () => 12_500 },
			{ balance: 10_00 }
		);
		const refused = quarter.open(10, { risk: "low" });
		expect(!refused.ok && refused.message).toMatch(/cannot be bet at this amount/);
		expect(quarter.balance).toBe(10_00);
		expect(quarter.open(20, { risk: "low" }).ok).toBe(true);
		expect(quarter.balance).toBe(9_75);
	});

	it("draws from the seeds it shows, so a round can be checked against them", () => {
		const site = createStandIn(tossup);
		site.open(10, { risk: "low" });
		const revealed = (() => {
			const result = site.act({ pick: "heads" });
			if (!result.ok) throw new Error(result.message);
			return { payout: result.round.payout, seeds: site.fairness };
		})();
		const serverSeed = site.rotateSeeds()!;
		const outcome = tossup.outcome(
			{ risk: "low", pick: "heads" },
			createRng(serverSeed, revealed.seeds.clientSeed, 1)
		)!;
		expect(revealed.payout).toBe(
			settlePayout(
				10,
				outcome.payoutBp,
				payoutRoll(serverSeed, revealed.seeds.clientSeed, 1)
			)
		);
	});

	it("refuses as the site refuses, and a refusal changes nothing", () => {
		const site = createStandIn(tossup, { balance: 50 });
		expect(site.limits).toEqual({ minStake: MIN_STAKE, maxStake: MAX_STAKE });
		const refused = (reply: ReturnType<typeof site.open>) =>
			reply.ok ? null : reply;

		expect(refused(site.open(MIN_STAKE - 1, { risk: "low" }))?.message).toMatch(
			/smallest bet/
		);
		expect(refused(site.open(MAX_STAKE + 1, { risk: "low" }))?.message).toMatch(
			/largest bet/
		);
		expect(refused(site.open(10, { risk: "sideways" }))?.message).toMatch(
			/options are not valid/
		);
		expect(refused(site.open(1_00, { risk: "low" }))?.reason).toBe("insufficient");
		expect(refused(site.act({ pick: "heads" }))?.message).toMatch(
			/no round in progress/
		);

		site.open(10, { risk: "low" });
		expect(refused(site.open(10, { risk: "low" }))?.message).toMatch(
			/Finish the round/
		);
		expect(refused(site.act({ pick: "edge" }))?.message).toMatch(/move is not valid/);
		expect(site.rotateSeeds()).toBeNull();
		expect(site.balance).toBe(40);
		expect(site.fairness.nonce).toBe(1);
	});

	it("keeps progress for each stake, moved on once a round settles", () => {
		const site = createStandIn(tossup);
		for (let i = 0; i < 3; i++) {
			site.open(20, { risk: "low" });
			site.act({ pick: "tails" });
		}
		expect(site.progress(20)).toEqual({ meter: 3 });
		expect(site.progress(30)).toEqual({ meter: 0 });
	});

	it("turns a game that breaks a rule into a refusal that says so", () => {
		const broken = { ...tossup, start: () => ({ pad: "x".repeat(20_000) }) as never };
		const site = createStandIn(broken, { balance: 1_00 });
		const reply = site.open(10, { risk: "low" });
		expect(reply.ok).toBe(false);
		expect(!reply.ok && reply.message).toMatch(
			/broke a rule of the site: .*too large a round/
		);
		expect(site.balance).toBe(1_00);
	});
});
