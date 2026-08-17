/** Party-wide pickup / party size, kept as a decimal share (rounded to 2 places) rather than floored to a whole item — a single indivisible drop split across a party (e.g. 1 card / 4 people) would otherwise floor to 0 and vanish instead of being tracked as each member's fractional value share. */
export function partyShare(totalQty: number, party: number): number {
  return Math.round((totalQty / party) * 100) / 100;
}

/** Splits a free-typed "PTメンバー" field (space/comma/、-separated) into individual names, trimmed and with blanks dropped. */
export function parseMemberNames(input: string): string[] {
  return input
    .split(/[,、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
