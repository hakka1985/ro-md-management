import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { WishlistItem } from "../../db/types";

export function useWishlist() {
  const items = useLiveQuery(
    async () => {
      const all = await db.wishlistItems.toArray();
      return all.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    },
    [],
    [] as WishlistItem[],
  );

  async function addItem(input: {
    itemName: string;
    quantity: number;
    unitCost: number;
    memo?: string;
    eventTag?: string;
    refineTarget?: string;
  }) {
    const maxPriority = (items ?? []).reduce(
      (max, i) => Math.max(max, i.priority ?? 0),
      -1,
    );
    await db.wishlistItems.add({
      id: newId(),
      itemName: input.itemName,
      quantity: input.quantity,
      unitCost: input.unitCost,
      memo: input.memo || undefined,
      obtained: false,
      priority: maxPriority + 1,
      eventTag: input.eventTag || undefined,
      refineTarget: input.refineTarget || undefined,
      obtainedQuantity: input.eventTag ? 0 : undefined,
      achievedQuantity: input.eventTag ? 0 : undefined,
      createdAt: Date.now(),
    });
  }

  async function setObtained(id: string, obtained: boolean) {
    await db.wishlistItems.update(id, { obtained });
  }

  /** Adjusts an event item's procured count, clamped to [0, quantity] — pulling it down also clamps achievedQuantity down to match (can't have refined more than you've bought). */
  async function adjustObtainedQuantity(id: string, delta: number) {
    const item = (items ?? []).find((i) => i.id === id);
    if (!item) return;
    const nextObtained = Math.max(
      0,
      Math.min(item.quantity, (item.obtainedQuantity ?? 0) + delta),
    );
    const nextAchieved = Math.min(item.achievedQuantity ?? 0, nextObtained);
    await db.wishlistItems.update(id, {
      obtainedQuantity: nextObtained,
      achievedQuantity: nextAchieved,
    });
  }

  /** Adjusts an event item's refine-target-achieved count, clamped to [0, obtainedQuantity]. */
  async function adjustAchievedQuantity(id: string, delta: number) {
    const item = (items ?? []).find((i) => i.id === id);
    if (!item) return;
    const nextAchieved = Math.max(
      0,
      Math.min(
        item.obtainedQuantity ?? 0,
        (item.achievedQuantity ?? 0) + delta,
      ),
    );
    await db.wishlistItems.update(id, { achievedQuantity: nextAchieved });
  }

  async function updateItem(
    id: string,
    patch: Partial<Omit<WishlistItem, "id" | "createdAt">>,
  ) {
    await db.wishlistItems.update(id, patch);
  }

  async function deleteItem(id: string) {
    await db.wishlistItems.delete(id);
  }

  /** Re-inserts a previously-deleted item as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreItem(record: WishlistItem) {
    await db.wishlistItems.add(record);
  }

  /** Drag-reorders pending items by priority — mirrors reorderDungeon/reorderCharacter's splice-and-renumber pattern. */
  async function reorderItem(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const ordered = [...(items ?? [])];
    const from = ordered.findIndex((i) => i.id === dragId);
    const to = ordered.findIndex((i) => i.id === dropId);
    if (from === -1 || to === -1) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await db.transaction("rw", db.wishlistItems, async () => {
      for (let i = 0; i < ordered.length; i++) {
        await db.wishlistItems.update(ordered[i].id, { priority: i });
      }
    });
  }

  return {
    items,
    addItem,
    setObtained,
    updateItem,
    deleteItem,
    restoreItem,
    reorderItem,
    adjustObtainedQuantity,
    adjustAchievedQuantity,
  };
}
