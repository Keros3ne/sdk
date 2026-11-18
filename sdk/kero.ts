/**
 * Kero is stored and computed as integer cents. These helpers are the only place
 * that converts between cents and what a player reads or types.
 */

export const CENTS_PER_KERO = 100;

/** 125000 -> "1,250.00" */
export function formatKero(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	const whole = Math.floor(abs / CENTS_PER_KERO).toString();
	const frac = (abs % CENTS_PER_KERO).toString().padStart(2, "0");
	return `${sign}${whole.replace(/\B(?=(\d{3})+$)/g, ",")}.${frac}`;
}

/**
 * "1,250.5" -> 125050. Returns `null` for anything that is not a plain,
 * non-negative amount with at most two decimals. Works on the digits directly,
 * so no floating-point value is ever involved.
 */
export function parseKero(input: string): number | null {
	const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
	if (!match) return null;
	const whole = Number(match[1].replaceAll(",", ""));
	const frac = Number((match[2] ?? "").padEnd(2, "0"));
	const cents = whole * CENTS_PER_KERO + frac;
	return Number.isSafeInteger(cents) ? cents : null;
}

/** @deprecated The currency was called fuel: use `formatKero`. Kept for studios built before the rename. */
export const formatFuel = formatKero;
/** @deprecated The currency was called fuel: use `parseKero`. Kept for studios built before the rename. */
export const parseFuel = parseKero;
