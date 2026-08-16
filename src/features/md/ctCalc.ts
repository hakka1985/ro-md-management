import type { Character, MdCtType, MdDungeon, MdRun } from "../../db/types";

export interface CtStatus {
  available: boolean;
  nextAvailableAt: number | null;
  /** How many more times this character can still clear before every attempt slot is on cooldown. Always attemptsPerCycle when nothing's been cleared yet, 0 when locked out. */
  remainingAttempts: number;
}

/**
 * Fixed-reset-time model ported from the reference tool
 * (https://github.com/d44aki-lang/RO-tools): RO's MD cooldowns reset at a
 * fixed server time, not N hours after the last clear.
 *   daily        -> next 05:00 after the clear
 *   3days        -> the daily 05:00 boundary, then +2 days
 *   weeklyTue12  -> next Tuesday 12:00 after the clear
 */
export function calcNextReset(ctType: MdCtType, lastClearAt: number): number {
  const last = new Date(lastClearAt);
  const next = new Date(last);

  if (ctType === "daily" || ctType === "3days") {
    next.setHours(5, 0, 0, 0);
    if (next.getTime() <= last.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    if (ctType === "3days") {
      next.setDate(next.getDate() + 2);
    }
    return next.getTime();
  }

  // weeklyTue12: next Tuesday (day 2) at 12:00
  let diff = 2 - next.getDay();
  next.setDate(next.getDate() + diff);
  next.setHours(12, 0, 0, 0);
  if (next.getTime() <= last.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next.getTime();
}

export function getLatestRun(
  runs: MdRun[],
  characterId: string,
  dungeonId: string,
): MdRun | null {
  return runs
    .filter((r) => r.characterId === characterId && r.dungeonId === dungeonId)
    .reduce<MdRun | null>(
      (acc, r) => (!acc || r.completedAt > acc.completedAt ? r : acc),
      null,
    );
}

/**
 * Pure function: CT is derived from recorded runs, never stored, so editing
 * the dungeon's ctType/attemptsPerCycle later stays consistent.
 *
 * Some MDs allow more than one clear per character per cycle
 * (attemptsPerCycle > 1) — modeled as N independent attempt slots, each with
 * its own CT clock starting from whichever run consumed it. The character is
 * locked out only once every one of the most recent `attemptsPerCycle` runs
 * is still within its own CT window; attemptsPerCycle=1 (the default)
 * reduces exactly to the original single-attempt behavior.
 */
export function getCtStatus(
  characterId: string,
  dungeonId: string,
  ctType: MdCtType,
  runs: MdRun[],
  now: number = Date.now(),
  attemptsPerCycle: number = 1,
): CtStatus {
  const recentRuns = runs
    .filter((r) => r.characterId === characterId && r.dungeonId === dungeonId)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, attemptsPerCycle);

  const activeCooldowns = recentRuns
    .map((r) => calcNextReset(ctType, r.completedAt))
    .filter((resetAt) => now < resetAt);

  const remainingAttempts = attemptsPerCycle - activeCooldowns.length;
  const available = remainingAttempts > 0;
  const nextAvailableAt = available ? null : Math.min(...activeCooldowns);

  return { available, nextAvailableAt, remainingAttempts };
}

export function formatRemaining(
  nextAvailableAt: number,
  now: number = Date.now(),
): string {
  const remainingMs = nextAvailableAt - now;
  if (remainingMs <= 0) return "利用可能";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `残り${days}日${remHours}時間`;
  }
  return hours > 0 ? `残り${hours}時間${minutes}分` : `残り${minutes}分`;
}

export function getCtLabel(ctType: MdCtType): string {
  if (ctType === "daily") return "翌日";
  if (ctType === "3days") return "3日";
  return "週間";
}

/** Distinct badge color per CT interval, so daily/3-day/weekly MDs are visually distinguishable at a glance, not just by text. */
export function getCtBadgeClass(ctType: MdCtType): string {
  if (ctType === "daily") return "ct-badge ct-badge-daily";
  if (ctType === "3days") return "ct-badge ct-badge-3days";
  return "ct-badge ct-badge-weekly";
}

/** Default all-defeated record for a dungeon's current mob list — the common case, adjustable per checkbox. */
export function defaultMvpDefeats(mobNames: string[]): Record<string, boolean> {
  return Object.fromEntries(mobNames.map((m) => [m, true]));
}

/** Every MVP mob name the dungeon can produce, across all its modes — falls back to the flat mvpMobs list for dungeons with no modes configured. Used where a dungeon-wide summary (not a single recorded run) is needed, e.g. the grid's per-dungeon kill tally. */
export function getAllMvpMobNames(dungeon: MdDungeon): string[] {
  if (dungeon.modes && dungeon.modes.length > 0) {
    return [...new Set(dungeon.modes.flatMap((m) => m.mvpMobs))];
  }
  return dungeon.mvpMobs;
}

/**
 * Count of OTHER characters sharing `character.account` who currently have
 * a live (not-yet-reset) run for this dungeon — some MDs cap how many
 * characters from one account may challenge them per cycle. A character
 * with no account set can't be grouped with anyone, so this is always 0.
 */
export function getAccountRunCount(
  characters: Character[],
  runs: MdRun[],
  dungeon: MdDungeon,
  character: Character,
): number {
  if (!character.account) return 0;
  return characters.filter((c) => {
    if (c.id === character.id || c.account !== character.account) {
      return false;
    }
    const status = getCtStatus(
      c.id,
      dungeon.id,
      dungeon.ctType,
      runs,
      undefined,
      dungeon.attemptsPerCycle ?? 1,
    );
    return getLatestRun(runs, c.id, dungeon.id) !== null && !status.available;
  }).length;
}

/** True when `dungeon.requiredLevel` is set and the character hasn't reached it (or has no level recorded at all). */
export function isLevelExcluded(
  dungeon: MdDungeon,
  character: Character,
): boolean {
  return (
    dungeon.requiredLevel !== undefined &&
    (character.level === undefined || character.level < dungeon.requiredLevel)
  );
}

/** Single source of truth for "can this character even attempt this MD" — manual per-dungeon/global 対象外 flags plus the automatic level gate. Shared by the grid and the dashboard TODO card so they never drift apart. */
export function isMdExcluded(dungeon: MdDungeon, character: Character): boolean {
  return (
    !!character.mdExcluded ||
    !!dungeon.excludedCharacterIds?.includes(character.id) ||
    isLevelExcluded(dungeon, character)
  );
}

export interface AvailableMdTaskCharacter {
  id: string;
  name: string;
}

export interface AvailableMdTaskGroup {
  dungeonId: string;
  dungeonName: string;
  characters: AvailableMdTaskCharacter[];
}

/** Powers the dashboard's "本日のTODO" card — grouped by MD, each with the characters whose CT is currently open and isn't excluded, i.e. still worth going to do. Dungeons with nothing available are omitted; groups are sorted by how many characters can go, most first. */
export function getAvailableMdTasksGrouped(
  dungeons: MdDungeon[],
  characters: Character[],
  runs: MdRun[],
  now: number = Date.now(),
): AvailableMdTaskGroup[] {
  const groups: AvailableMdTaskGroup[] = [];
  for (const dungeon of dungeons) {
    if (dungeon.archived) continue;
    const eligible: AvailableMdTaskCharacter[] = [];
    for (const character of characters) {
      if (character.archived || isMdExcluded(dungeon, character)) continue;
      const status = getCtStatus(
        character.id,
        dungeon.id,
        dungeon.ctType,
        runs,
        now,
        dungeon.attemptsPerCycle ?? 1,
      );
      if (status.available) eligible.push({ id: character.id, name: character.name });
    }
    if (eligible.length > 0) {
      groups.push({ dungeonId: dungeon.id, dungeonName: dungeon.name, characters: eligible });
    }
  }
  return groups.sort((a, b) => b.characters.length - a.characters.length);
}

export interface UpcomingMdTask {
  dungeonId: string;
  dungeonName: string;
  characterId: string;
  characterName: string;
  availableAt: number;
}

/**
 * Character×dungeon combos currently on cooldown but opening up within
 * `withinMs` — a companion to getAvailableMdTasksGrouped so upcoming
 * availability doesn't get missed just because it isn't open *right now*.
 * Sorted soonest-first.
 */
export function getUpcomingMdTasks(
  dungeons: MdDungeon[],
  characters: Character[],
  runs: MdRun[],
  now: number = Date.now(),
  withinMs: number = 3 * 60 * 60 * 1000,
): UpcomingMdTask[] {
  const results: UpcomingMdTask[] = [];
  for (const dungeon of dungeons) {
    if (dungeon.archived) continue;
    for (const character of characters) {
      if (character.archived || isMdExcluded(dungeon, character)) continue;
      const status = getCtStatus(
        character.id,
        dungeon.id,
        dungeon.ctType,
        runs,
        now,
        dungeon.attemptsPerCycle ?? 1,
      );
      if (status.available || status.nextAvailableAt === null) continue;
      if (status.nextAvailableAt - now <= withinMs) {
        results.push({
          dungeonId: dungeon.id,
          dungeonName: dungeon.name,
          characterId: character.id,
          characterName: character.name,
          availableAt: status.nextAvailableAt,
        });
      }
    }
  }
  return results.sort((a, b) => a.availableAt - b.availableAt);
}
