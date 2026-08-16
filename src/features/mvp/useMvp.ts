import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { MvpMaster, MvpKill } from "../../db/types";

export function useMvpMaster() {
  const mvpMaster = useLiveQuery(
    () => db.mvpMaster.orderBy("name").toArray(),
    [],
    [] as MvpMaster[],
  );

  /** Rejects a duplicate name among non-archived MVPs (prevents the "same one shows up twice" bug from re-occurring). */
  async function addMvp(input: {
    name: string;
    cardName?: string;
    map?: string;
    dropItems?: string[];
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const existing = await db.mvpMaster
      .filter((m) => m.name === input.name && !m.archived)
      .first();
    if (existing) {
      return { ok: false, error: `「${input.name}」は既に登録されています。` };
    }
    await db.mvpMaster.add({
      id: newId(),
      name: input.name,
      cardName: input.cardName || undefined,
      map: input.map || undefined,
      dropItems: input.dropItems?.length ? input.dropItems : undefined,
      archived: false,
    });
    return { ok: true };
  }

  async function updateMvp(id: string, patch: Partial<Omit<MvpMaster, "id">>) {
    await db.mvpMaster.update(id, patch);
  }

  async function archiveMvp(id: string, archived: boolean) {
    await db.mvpMaster.update(id, { archived });
  }

  /** Imports a previously-exported MVPマスタ JSON — "replace" clears the table first, "merge" upserts by id (same semantics as the full export/import). */
  async function importMvpMaster(
    rows: MvpMaster[],
    mode: "merge" | "replace",
  ) {
    await db.transaction("rw", db.mvpMaster, async () => {
      if (mode === "replace") await db.mvpMaster.clear();
      await db.mvpMaster.bulkPut(rows);
    });
  }

  return { mvpMaster, addMvp, updateMvp, archiveMvp, importMvpMaster };
}

export function useMvpKills() {
  const kills = useLiveQuery(
    () => db.mvpKills.orderBy("killedAt").reverse().toArray(),
    [],
    [] as MvpKill[],
  );

  async function logKill(input: {
    mvpId: string;
    characterId?: string;
    killedAt: number;
    cardDropped: boolean;
    cardName?: string;
    itemsDropped?: string[];
    memo?: string;
  }) {
    await db.mvpKills.add({
      id: newId(),
      mvpId: input.mvpId,
      characterId: input.characterId || undefined,
      killedAt: input.killedAt,
      cardDropped: input.cardDropped,
      cardName: input.cardDropped ? input.cardName || undefined : undefined,
      itemsDropped: input.itemsDropped?.length ? input.itemsDropped : undefined,
      memo: input.memo || undefined,
      createdAt: Date.now(),
    });
  }

  async function updateKill(
    id: string,
    patch: Partial<Omit<MvpKill, "id" | "createdAt">>,
  ) {
    await db.mvpKills.update(id, patch);
  }

  async function deleteKill(id: string) {
    await db.mvpKills.delete(id);
  }

  /** Re-inserts a previously-deleted kill as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreKill(record: MvpKill) {
    await db.mvpKills.add(record);
  }

  return { kills, logKill, updateKill, deleteKill, restoreKill };
}
