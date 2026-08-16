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
      createdAt: Date.now(),
    });
  }

  async function setObtained(id: string, obtained: boolean) {
    await db.wishlistItems.update(id, { obtained });
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
  };
}
