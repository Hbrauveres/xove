/** Who's in the room, for an empty stage (spec 0107): up to three names, then "and N others". */
export function whoIsHere(names: string[]): string {
  const waiting = "waiting for someone to go live.";
  if (names.length === 0) return "Nobody else is here yet.";
  if (names.length === 1) return `${names[0]} is here, ${waiting}`;
  const list =
    names.length <= 3
      ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
      : `${names[0]}, ${names[1]} and ${names.length - 2} others`;
  return `${list} are here, ${waiting}`;
}
