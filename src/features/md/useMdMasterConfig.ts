import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { MdDungeon } from "../../db/types";

const ITEM_ORDER_KEY = "mdItemOrder";
const TRANSPOSE_KEY = "mdMasterTranspose";

function initialItemOrder(dungeons: MdDungeon[]): string[] {
  const set = new Set<string>();
  for (const d of dungeons) {
    for (const name of Object.keys(d.items)) set.add(name);
  }
  return [...set];
}

export function useMdMasterConfig(dungeons: MdDungeon[]) {
  const itemOrderRow = useLiveQuery(() => db.appConfig.get(ITEM_ORDER_KEY), []);
  const transposeRow = useLiveQuery(() => db.appConfig.get(TRANSPOSE_KEY), []);

  const itemOrder =
    (itemOrderRow?.value as string[] | undefined) ?? initialItemOrder(dungeons);
  const transpose = (transposeRow?.value as boolean | undefined) ?? false;

  async function setItemOrder(order: string[]) {
    await db.appConfig.put({ key: ITEM_ORDER_KEY, value: order });
  }

  /** Also registers the item in the item master (at 0z) if it isn't there yet, so it's searchable/editable right away instead of only appearing after a trade or MD drop happens to use it. */
  async function addItemToMaster(name: string) {
    if (!name.trim() || itemOrder.includes(name)) return;
    await setItemOrder([...itemOrder, name]);
    const existing = await db.itemPrices
      .where("itemName")
      .equals(name)
      .first();
    if (!existing) {
      await db.itemPrices.add({
        id: newId(),
        itemName: name,
        expectedPrice: 0,
        archived: false,
      });
    }
  }

  /** Removes the item column from every dungeon's items, not just the display order (matches the reference tool). */
  async function removeItemFromMaster(name: string) {
    await setItemOrder(itemOrder.filter((n) => n !== name));
    await db.transaction("rw", db.mdDungeons, async () => {
      for (const d of dungeons) {
        if (name in d.items) {
          const next = { ...d.items };
          delete next[name];
          await db.mdDungeons.update(d.id, { items: next });
        }
      }
    });
  }

  async function reorderItem(dragName: string, dropName: string) {
    if (dragName === dropName) return;
    const next = [...itemOrder];
    const from = next.indexOf(dragName);
    const to = next.indexOf(dropName);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragName);
    await setItemOrder(next);
  }

  async function toggleTranspose() {
    await db.appConfig.put({ key: TRANSPOSE_KEY, value: !transpose });
  }

  return {
    itemOrder,
    transpose,
    addItemToMaster,
    removeItemFromMaster,
    reorderItem,
    toggleTranspose,
  };
}
