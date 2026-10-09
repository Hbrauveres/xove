/** How long someone has been in the room (spec 0158): "just arrived", "here 12 min", "here 1 h 5 min". */
export function hereFor(since: number, now: number): string {
  const min = Math.floor(Math.max(0, now - since) / 60000);
  if (min < 1) return "just arrived";
  if (min < 60) return `here ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `here ${h} h` : `here ${h} h ${m} min`;
}
