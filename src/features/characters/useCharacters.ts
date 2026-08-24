import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { Character } from "../../db/types";

export function useCharacters() {
  const characters = useLiveQuery(
    async () => {
      const all = await db.characters.toArray();
      return all.sort((a, b) => {
        const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        const ao = a.sortOrder ?? a.createdAt;
        const bo = b.sortOrder ?? b.createdAt;
        return ao - bo;
      });
    },
    [],
    [] as Character[],
  );

  async function addCharacter(input: {
    name: string;
    server: string;
    account?: string;
    job?: string;
    level?: number;
    jobLevel?: number;
    money?: number;
    memo?: string;
  }) {
    const now = Date.now();
    const maxOrder = (characters ?? []).reduce(
      (max, c) => Math.max(max, c.sortOrder ?? 0),
      -1,
    );
    await db.characters.add({
      id: newId(),
      name: input.name,
      server: input.server,
      account: input.account || undefined,
      job: input.job || undefined,
      level: input.level,
      jobLevel: input.jobLevel,
      money: input.money,
      memo: input.memo || undefined,
      archived: false,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Drags dragId to sit just before dropId, reindexing sortOrder for all characters (matches useMdDungeons.reorderDungeon). */
  async function reorderCharacter(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const ordered = [...(characters ?? [])];
    const from = ordered.findIndex((c) => c.id === dragId);
    const to = ordered.findIndex((c) => c.id === dropId);
    if (from === -1 || to === -1) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await db.transaction("rw", db.characters, async () => {
      for (let i = 0; i < ordered.length; i++) {
        await db.characters.update(ordered[i].id, { sortOrder: i });
      }
    });
  }

  async function updateCharacter(
    id: string,
    patch: Partial<Omit<Character, "id">>,
  ) {
    await db.characters.update(id, { ...patch, updatedAt: Date.now() });
  }

  async function archiveCharacter(id: string, archived: boolean) {
    await updateCharacter(id, { archived });
  }

  async function togglePinned(id: string, pinned: boolean) {
    await updateCharacter(id, { pinned });
  }

  async function deleteCharacter(id: string) {
    await db.characters.delete(id);
  }

  /** Upserts by (name, server): updates the existing character if one matches, otherwise adds a new one. */
  async function bulkUpsertCharacters(
    inputs: {
      name: string;
      server?: string;
      account?: string;
      job?: string;
      level?: number;
      jobLevel?: number;
      memo?: string;
    }[],
  ): Promise<number> {
    const existing = await db.characters.toArray();
    let maxOrder = existing.reduce(
      (max, c) => Math.max(max, c.sortOrder ?? 0),
      -1,
    );
    const now = Date.now();
    let count = 0;
    for (const input of inputs) {
      if (!input.name) continue;
      const server = input.server || "";
      const match = existing.find(
        (c) => c.name === input.name && c.server === server,
      );
      if (match) {
        await db.characters.update(match.id, {
          account: input.account ?? match.account,
          job: input.job ?? match.job,
          level: input.level ?? match.level,
          jobLevel: input.jobLevel ?? match.jobLevel,
          memo: input.memo ?? match.memo,
          updatedAt: now,
        });
      } else {
        maxOrder += 1;
        await db.characters.add({
          id: newId(),
          name: input.name,
          server,
          account: input.account || undefined,
          job: input.job || undefined,
          level: input.level,
          jobLevel: input.jobLevel,
          memo: input.memo || undefined,
          archived: false,
          sortOrder: maxOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
      count++;
    }
    return count;
  }

  return {
    characters,
    addCharacter,
    updateCharacter,
    archiveCharacter,
    deleteCharacter,
    bulkUpsertCharacters,
    reorderCharacter,
    togglePinned,
  };
}
