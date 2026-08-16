import { db } from "./db";
import { newId } from "../lib/id";
import { mvpMasterSeed } from "../features/mvp/masterData";
import { mdDungeonSeed } from "../features/md/masterData";
import { itemPriceSeed } from "../features/finance/masterData";
import type { MvpMaster, ItemPrice } from "./types";

/**
 * Populates starter master data on first run only; never overwrites user edits.
 * Each check-then-insert runs inside its own 'rw' transaction on the target
 * table, so concurrent calls (e.g. React StrictMode's double effect-invoke
 * in dev, or two tabs opened at once) serialize instead of racing — the
 * second transaction's count() re-read sees the first transaction's insert
 * and skips.
 */
export async function seedInitialData(): Promise<void> {
  await db.transaction("rw", db.mvpMaster, async () => {
    const mvpCount = await db.mvpMaster.count();
    if (mvpCount === 0) {
      await db.mvpMaster.bulkAdd(
        mvpMasterSeed.map((m) => ({ id: newId(), ...m })),
      );
    }
  });

  await db.transaction("rw", db.mdDungeons, async () => {
    const dungeonCount = await db.mdDungeons.count();
    if (dungeonCount === 0 && mdDungeonSeed.length > 0) {
      await db.mdDungeons.bulkAdd(
        mdDungeonSeed.map((d) => ({ id: newId(), ...d })),
      );
    }
  });

  await db.transaction("rw", db.itemPrices, async () => {
    const itemPriceCount = await db.itemPrices.count();
    if (itemPriceCount === 0 && itemPriceSeed.length > 0) {
      await db.itemPrices.bulkAdd(
        itemPriceSeed.map((p) => ({ id: newId(), ...p })),
      );
    }
  });

  await dedupeMvpMaster();
  await dedupeItemPrices();
  await ensureItemMasterCoversMdItems();
}

/**
 * Every item name referenced anywhere in MD master's item matrix should
 * also exist in the item master (at 0z until the user fills in a price),
 * so it's visible/searchable/editable right away instead of only appearing
 * after the first trade or MD drop that happens to use it. Runs
 * unconditionally on every load — covers both the initial seed's items and
 * any items added later via MD master (see useMdMasterConfig.addItemToMaster,
 * which also does this immediately; this is the eventual-consistency backstop).
 */
async function ensureItemMasterCoversMdItems(): Promise<void> {
  await db.transaction("rw", db.mdDungeons, db.itemPrices, async () => {
    const dungeons = await db.mdDungeons.toArray();
    const itemNames = new Set<string>();
    for (const d of dungeons) {
      for (const name of Object.keys(d.items)) itemNames.add(name);
    }
    const known = new Set(
      (await db.itemPrices.toArray()).map((p) => p.itemName),
    );
    const missing = [...itemNames].filter((name) => !known.has(name));
    if (missing.length > 0) {
      await db.itemPrices.bulkAdd(
        missing.map((itemName) => ({
          id: newId(),
          itemName,
          expectedPrice: 0,
          archived: false,
        })),
      );
    }
  });
}

/**
 * One-time cleanup for a past race-condition bug that let duplicate
 * mvpMaster rows (same name) get created. Keeps the most-complete entry per
 * name and re-points any mvpKills referencing a removed duplicate's id
 * before deleting it, so no kill record is orphaned.
 */
async function dedupeMvpMaster(): Promise<void> {
  await db.transaction("rw", db.mvpMaster, db.mvpKills, async () => {
    const all = await db.mvpMaster.toArray();
    const byName = new Map<string, MvpMaster[]>();
    for (const m of all) {
      const list = byName.get(m.name) ?? [];
      list.push(m);
      byName.set(m.name, list);
    }
    for (const group of byName.values()) {
      if (group.length <= 1) continue;
      const keeper = group.reduce((best, cur) => {
        const bestScore =
          (best.cardName ? 1 : 0) + (best.dropItems?.length ? 1 : 0);
        const curScore =
          (cur.cardName ? 1 : 0) + (cur.dropItems?.length ? 1 : 0);
        return curScore > bestScore ? cur : best;
      });
      for (const dup of group) {
        if (dup.id === keeper.id) continue;
        await db.mvpKills
          .where("mvpId")
          .equals(dup.id)
          .modify({ mvpId: keeper.id });
        await db.mvpMaster.delete(dup.id);
      }
    }
  });
}

/**
 * Same cleanup for itemPrices — other tables reference items by itemName
 * (not id), so removing the surplus duplicate rows needs no reassignment.
 */
async function dedupeItemPrices(): Promise<void> {
  await db.transaction("rw", db.itemPrices, async () => {
    const all = await db.itemPrices.toArray();
    const byName = new Map<string, ItemPrice[]>();
    for (const p of all) {
      const list = byName.get(p.itemName) ?? [];
      list.push(p);
      byName.set(p.itemName, list);
    }
    for (const group of byName.values()) {
      if (group.length <= 1) continue;
      const keeper = group.reduce((best, cur) =>
        cur.expectedPrice > 0 && best.expectedPrice === 0 ? cur : best,
      );
      for (const dup of group) {
        if (dup.id !== keeper.id) await db.itemPrices.delete(dup.id);
      }
    }
  });
}
