/**
 * What every item of a control bar shares: its look as the properties the bar's style
 * sheet reads, and its size against the rest of the bar, kept within bounds.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { ITEM_SCALE } from "../bar-rules.ts";
import { dress, segmentProperties, type SegmentLook } from "../look.ts";

/** An attachment that dresses an item's box in its look, and follows the look as it changes. */
export const dressItem = (look: () => SegmentLook | undefined) =>
	dress(() => segmentProperties(look()));

/** An item's size against the rest of the bar, within what an item may be: `undefined` left alone. */
export function itemSize(size: number | undefined): number | undefined {
	return size === undefined
		? undefined
		: Math.max(ITEM_SCALE.min, Math.min(ITEM_SCALE.max, size));
}
