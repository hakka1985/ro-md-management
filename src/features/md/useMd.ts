import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import {
  isBetterMdRecord,
  pickBestMdRecord,
  type MdRecordCandidate,
} from "./ctCalc";
import type { MdDungeon, MdRun } from "../../db/types";

/** Whether `candidate` would beat every other run of the same dungeon (excluding `excludeRunId`, for edits) under isBetterMdRecord — used by logRun/updateRun to stamp MdRun.isNewRecord. */
async function computeIsNewRecord(
  dungeonId: string,
  candidate: MdRecordCandidate,
  excludeRunId?: string,
): Promise<boolean> {
  const dungeon = await db.mdDungeons.get(dungeonId);
  if (!dungeon) return false;
  const otherRuns = await db.mdRuns.where("dungeonId").equals(dungeonId).toArray();
  const others = excludeRunId
    ? otherRuns.filter((r) => r.id !== excludeRunId)
    : otherRuns;
  const currentBest = pickBestMdRecord(others, dungeon);
  return !currentBest || isBetterMdRecord(candidate, currentBest, dungeon);
}

export function useMdDungeons() {
  const dungeons = useLiveQuery(
    async () => {
      const all = await db.mdDungeons.toArray();
      return all.sort((a, b) => {
        const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      });
    },
    [],
    [] as MdDungeon[],
  );

  async function addDungeon(input: {
    name: string;
    ctType: MdDungeon["ctType"];
    category?: string;
    mvpMobs?: string[];
    accountCharacterLimit?: number;
    requiredLevel?: number;
    tracksScore?: boolean;
    tracksRooms?: boolean;
  }) {
    const maxOrder = (dungeons ?? []).reduce(
      (max, d) => Math.max(max, d.sortOrder ?? 0),
      -1,
    );
    await db.mdDungeons.add({
      id: newId(),
      name: input.name,
      ctType: input.ctType,
      items: {},
      mvpMobs: input.mvpMobs ?? [],
      category: input.category || undefined,
      accountCharacterLimit: input.accountCharacterLimit,
      requiredLevel: input.requiredLevel,
      tracksScore: input.tracksScore,
      tracksRooms: input.tracksRooms,
      sortOrder: maxOrder + 1,
      archived: false,
    });
  }

  async function updateDungeon(
    id: string,
    patch: Partial<Omit<MdDungeon, "id">>,
  ) {
    await db.mdDungeons.update(id, patch);
  }

  async function archiveDungeon(id: string, archived: boolean) {
    await updateDungeon(id, { archived });
  }

  async function togglePinned(id: string, pinned: boolean) {
    await updateDungeon(id, { pinned });
  }

  /** Drags dragId to sit just before dropId, reindexing sortOrder for all dungeons (matches the reference tool's row reorder). */
  async function reorderDungeon(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const ordered = [...(dungeons ?? [])];
    const from = ordered.findIndex((d) => d.id === dragId);
    const to = ordered.findIndex((d) => d.id === dropId);
    if (from === -1 || to === -1) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await db.transaction("rw", db.mdDungeons, async () => {
      for (let i = 0; i < ordered.length; i++) {
        await db.mdDungeons.update(ordered[i].id, { sortOrder: i });
      }
    });
  }

  /** Toggles whether a character is manually excluded (対象外) from this MD, e.g. a quest gate the tool can't infer. Level gating is handled automatically via requiredLevel instead. */
  async function toggleExclusion(dungeonId: string, characterId: string) {
    const dungeon = (dungeons ?? []).find((d) => d.id === dungeonId);
    if (!dungeon) return;
    const current = dungeon.excludedCharacterIds ?? [];
    const next = current.includes(characterId)
      ? current.filter((id) => id !== characterId)
      : [...current, characterId];
    await db.mdDungeons.update(dungeonId, { excludedCharacterIds: next });
  }

  /** Imports a previously-exported MDマスタ JSON — "replace" clears the table first, "merge" upserts by id (same semantics as the full export/import). */
  async function importDungeons(
    rows: MdDungeon[],
    mode: "merge" | "replace",
  ) {
    await db.transaction("rw", db.mdDungeons, async () => {
      if (mode === "replace") await db.mdDungeons.clear();
      await db.mdDungeons.bulkPut(rows);
    });
  }

  return {
    dungeons,
    addDungeon,
    updateDungeon,
    archiveDungeon,
    reorderDungeon,
    toggleExclusion,
    togglePinned,
    importDungeons,
  };
}

export function useMdRuns() {
  const runs = useLiveQuery(
    () => db.mdRuns.orderBy("completedAt").reverse().toArray(),
    [],
    [] as MdRun[],
  );

  async function logRun(input: {
    characterId: string;
    dungeonId: string;
    completedAt: number;
    mvpDefeats: Record<string, boolean>;
    clearTimeSeconds?: number;
    score?: number;
    rooms?: number;
    items?: Record<string, number>;
    memo?: string;
    modeName?: string;
    estimatedCost?: number;
    partySize?: number;
    partyMembers?: string[];
  }): Promise<string> {
    const id = newId();
    const isNewRecord = await computeIsNewRecord(input.dungeonId, {
      score: input.score,
      rooms: input.rooms,
      clearTimeSeconds: input.clearTimeSeconds,
    });
    await db.mdRuns.add({
      id,
      characterId: input.characterId,
      dungeonId: input.dungeonId,
      completedAt: input.completedAt,
      mvpDefeats: input.mvpDefeats,
      clearTimeSeconds: input.clearTimeSeconds,
      score: input.score,
      rooms: input.rooms,
      isNewRecord,
      items:
        input.items && Object.keys(input.items).length > 0
          ? input.items
          : undefined,
      memo: input.memo || undefined,
      modeName: input.modeName,
      estimatedCost: input.estimatedCost,
      partySize: input.partySize,
      partyMembers:
        input.partyMembers && input.partyMembers.length > 0
          ? input.partyMembers
          : undefined,
      createdAt: Date.now(),
    });
    return id;
  }

  async function updateRun(
    id: string,
    patch: Partial<Omit<MdRun, "id" | "createdAt">>,
  ) {
    const existing = await db.mdRuns.get(id);
    if (!existing) return;
    const merged = { ...existing, ...patch };
    const isNewRecord = await computeIsNewRecord(
      merged.dungeonId,
      {
        score: merged.score,
        rooms: merged.rooms,
        clearTimeSeconds: merged.clearTimeSeconds,
      },
      id,
    );
    await db.mdRuns.update(id, { ...patch, isNewRecord });
  }

  async function deleteRun(id: string) {
    await db.mdRuns.delete(id);
  }

  /** Re-inserts a previously-deleted run as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreRun(record: MdRun) {
    await db.mdRuns.add(record);
  }

  return { runs, logRun, updateRun, deleteRun, restoreRun };
}
