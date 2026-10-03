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
