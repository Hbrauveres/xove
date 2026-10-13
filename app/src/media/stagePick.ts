/**
 * Who is shown big for one viewer (spec 0060): the person they picked, while that person
 * is still sharing; otherwise the person sharing the longest. So the first sharer is big
 * by default, and when the big one stops, the longest sharing takes the place.
 *
 * @param sharing everyone with a live stream, the longest sharing first
 * @param picked  the viewer's last click on a thumbnail, if any
 */
export function stagePick(sharing: readonly string[], picked: string | null): string | null {
  if (picked !== null && sharing.includes(picked)) return picked;
  return sharing[0] ?? null;
}

/**
 * The next (`1`) or previous (`-1`) person for the stage (spec 0159), in the feed's order
 * (the longest sharing first), wrapping around at both ends. Null with fewer than two people.
 */
export function stepOnStage(order: readonly string[], current: string | null, direction: 1 | -1): string | null {
  if (order.length < 2) return null;
  const at = current === null ? -1 : order.indexOf(current);
  if (at === -1) return order[0];
  return order[(at + direction + order.length) % order.length];
}
