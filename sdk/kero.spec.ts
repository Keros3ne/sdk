import { describe, expect, it } from "vitest";
import { formatKero, parseKero } from "./kero";

describe("formatKero", () => {
	it("always shows two decimals and groups thousands", () => {
		expect(formatKero(0)).toBe("0.00");
		expect(formatKero(5)).toBe("0.05");
		expect(formatKero(2500)).toBe("25.00");
		expect(formatKero(125050)).toBe("1,250.50");
		expect(formatKero(1000000000)).toBe("10,000,000.00");
		expect(formatKero(-1999)).toBe("-19.99");
	});
});

describe("parseKero", () => {
	it("reads plain amounts into cents", () => {
		expect(parseKero("25")).toBe(2500);
		expect(parseKero("0.2")).toBe(20);
		expect(parseKero(" 1,250.50 ")).toBe(125050);
		expect(parseKero("0.07")).toBe(7);
	});

	it("is exact where floating point is not", () => {
		// 1.15 * 100 is 114.99999999999999 in floating point.
		expect(parseKero("1.15")).toBe(115);
	});

	it("rejects anything else", () => {
		for (const bad of ["", "-5", "1.234", "abc", "1,25", ".5", "1e3", "5."]) {
			expect(parseKero(bad), bad).toBeNull();
		}
	});
});
