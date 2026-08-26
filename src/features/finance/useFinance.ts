import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import { partyShare } from "../../lib/party";
import type {
  ItemPrice,
  InventoryItem,
  FinanceTransaction,
  FinanceSource,
  DebtEntry,
  DebtDirection,
  PartyObtainEntry,
  PartyMember,
} from "../../db/types";

/** Shared by useInventory().addStock and usePartyObtains().addPartyObtain — both bump the same aggregate quantity, just from different origins. */
async function bumpInventoryStock(itemName: string, quantity: number) {
  const existing = await db.inventoryItems
    .where("itemName")
    .equals(itemName)
    .first();
  if (existing) {
    await db.inventoryItems.update(existing.id, {
      quantity: existing.quantity + quantity,
      updatedAt: Date.now(),
    });
    return;
  }
  await db.inventoryItems.add({
    id: newId(),
    itemName,
    quantity,
    updatedAt: Date.now(),
  });
}

export function useItemPrices() {
  const itemPrices = useLiveQuery(
    () => db.itemPrices.orderBy("itemName").toArray(),
    [],
    [] as ItemPrice[],
  );

  async function upsertItemPrice(input: {
    itemName: string;
    expectedPrice: number;
    url?: string;
    memo?: string;
  }) {
    const existing = await db.itemPrices
      .where("itemName")
      .equals(input.itemName)
      .first();
    if (existing) {
      await db.itemPrices.update(existing.id, {
        expectedPrice: input.expectedPrice,
        url: input.url ?? existing.url,
        memo: input.memo || undefined,
        updatedAt:
          input.expectedPrice !== existing.expectedPrice
            ? Date.now()
            : existing.updatedAt,
      });
      return;
    }
    await db.itemPrices.add({
      id: newId(),
      itemName: input.itemName,
      expectedPrice: input.expectedPrice,
      url: input.url || undefined,
      memo: input.memo || undefined,
      archived: false,
      updatedAt: Date.now(),
    });
  }

  /** Bumps updatedAt whenever expectedPrice itself changes — powers the item-master price-staleness hint. */
  async function updateItemPrice(
    id: string,
    patch: Partial<Omit<ItemPrice, "id">>,
  ) {
    await db.itemPrices.update(id, {
      ...patch,
      ...(patch.expectedPrice !== undefined && { updatedAt: Date.now() }),
    });
  }

  async function archiveItemPrice(id: string, archived: boolean) {
    await db.itemPrices.update(id, { archived });
  }

  async function deleteItemPrice(id: string) {
    await db.itemPrices.delete(id);
  }

  /** Re-inserts a previously-deleted item price as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreItemPrice(record: ItemPrice) {
    await db.itemPrices.add(record);
  }

  /** Imports a previously-exported アイテムマスタ JSON — "replace" clears the table first, "merge" upserts by id (same semantics as the full export/import). */
  async function importItemPrices(
    rows: ItemPrice[],
    mode: "merge" | "replace",
  ) {
    await db.transaction("rw", db.itemPrices, async () => {
      if (mode === "replace") await db.itemPrices.clear();
      await db.itemPrices.bulkPut(rows);
    });
  }

  return {
    itemPrices,
    upsertItemPrice,
    updateItemPrice,
    archiveItemPrice,
    deleteItemPrice,
    restoreItemPrice,
    importItemPrices,
  };
}

export function useInventory() {
  const inventory = useLiveQuery(
    () => db.inventoryItems.orderBy("itemName").toArray(),
    [],
    [] as InventoryItem[],
  );

  async function addStock(itemName: string, quantity: number) {
    await bumpInventoryStock(itemName, quantity);
  }

  async function removeStock(itemName: string, quantity: number) {
    const existing = await db.inventoryItems
      .where("itemName")
      .equals(itemName)
      .first();
    if (!existing) return;
    const nextQuantity = Math.max(0, existing.quantity - quantity);
    await db.inventoryItems.update(existing.id, {
      quantity: nextQuantity,
      updatedAt: Date.now(),
    });
  }

  /** Directly sets the on-hand quantity without creating a transaction — for manual stocktake corrections. */
  async function setStock(itemName: string, quantity: number) {
    const existing = await db.inventoryItems
      .where("itemName")
      .equals(itemName)
      .first();
    if (existing) {
      await db.inventoryItems.update(existing.id, {
        quantity,
        updatedAt: Date.now(),
      });
      return;
    }
    await db.inventoryItems.add({
      id: newId(),
      itemName,
      quantity,
      updatedAt: Date.now(),
    });
  }

  async function updateInventoryMemo(id: string, memo: string) {
    await db.inventoryItems.update(id, { memo: memo || undefined });
  }

  async function deleteInventoryItem(id: string) {
    await db.inventoryItems.delete(id);
  }

  /** Re-inserts a previously-deleted inventory row as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreInventoryItem(record: InventoryItem) {
    await db.inventoryItems.add(record);
  }

  return {
    inventory,
    addStock,
    removeStock,
    setStock,
    updateInventoryMemo,
    deleteInventoryItem,
    restoreInventoryItem,
  };
}

export function useTransactions() {
  const transactions = useLiveQuery(
    () => db.financeTransactions.orderBy("date").reverse().toArray(),
    [],
    [] as FinanceTransaction[],
  );

  async function addTransaction(input: {
    type: "income" | "expense";
    itemName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    date: number;
    characterId?: string;
    source?: FinanceSource;
    sourceRefId?: string;
    partySize?: number;
    isEventIncome?: boolean;
    tags?: string[];
    memo?: string;
  }) {
    await db.financeTransactions.add({
      id: newId(),
      type: input.type,
      itemName: input.itemName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      date: input.date,
      characterId: input.characterId || undefined,
      source: input.source,
      sourceRefId: input.sourceRefId,
      partySize: input.partySize,
      isEventIncome: input.isEventIncome || undefined,
      tags: input.tags?.length ? input.tags : undefined,
      memo: input.memo || undefined,
      createdAt: Date.now(),
    });
  }

  async function updateTransaction(
    id: string,
    patch: Partial<Omit<FinanceTransaction, "id" | "createdAt">>,
  ) {
    await db.financeTransactions.update(id, patch);
  }

  async function deleteTransaction(id: string) {
    await db.financeTransactions.delete(id);
  }

  /** Re-inserts a previously-deleted record as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreTransaction(record: FinanceTransaction) {
    await db.financeTransactions.add(record);
  }

  return {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
  };
}

export function useDebts() {
  const debts = useLiveQuery(
    () => db.debts.orderBy("date").reverse().toArray(),
    [],
    [] as DebtEntry[],
  );

  async function addDebt(input: {
    direction: DebtDirection;
    counterparty: string;
    amount: number;
    date: number;
    memo?: string;
  }) {
    await db.debts.add({
      id: newId(),
      direction: input.direction,
      counterparty: input.counterparty,
      amount: input.amount,
      repaidAmount: 0,
      date: input.date,
      memo: input.memo || undefined,
      createdAt: Date.now(),
    });
  }

  /** Adds to the repaid amount, clamped so it never exceeds the original amount. */
  async function addRepayment(id: string, repaymentAmount: number) {
    const entry = await db.debts.get(id);
    if (!entry) return;
    const repaidAmount = Math.min(
      entry.amount,
      entry.repaidAmount + repaymentAmount,
    );
    await db.debts.update(id, { repaidAmount });
  }

  async function updateDebt(
    id: string,
    patch: Partial<Omit<DebtEntry, "id" | "createdAt">>,
  ) {
    await db.debts.update(id, patch);
  }

  async function deleteDebt(id: string) {
    await db.debts.delete(id);
  }

  /** Re-inserts a previously-deleted debt as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreDebt(record: DebtEntry) {
    await db.debts.add(record);
  }

  return {
    debts,
    addDebt,
    addRepayment,
    updateDebt,
    deleteDebt,
    restoreDebt,
  };
}

/**
 * PT-shared obtains (event MD drops split among a party, etc.), kept as
 * their own history — unlike solo 入手 (a bare stock bump with no record),
 * each entry remembers the total collected, party size/members, and this
 * account's computed share, so a mixed-origin stack can later be broken
 * back down into "how much came from which PT run."
 */
export function usePartyObtains() {
  const entries = useLiveQuery(
    () => db.partyObtains.orderBy("date").reverse().toArray(),
    [],
    [] as PartyObtainEntry[],
  );

  async function addPartyObtain(input: {
    itemName: string;
    totalQuantity: number;
    partySize: number;
    members: string[];
    date: number;
    memo?: string;
    sourceRunId?: string;
  }): Promise<number> {
    const myShare = partyShare(input.totalQuantity, input.partySize);
    await db.partyObtains.add({
      id: newId(),
      itemName: input.itemName,
      totalQuantity: input.totalQuantity,
      partySize: input.partySize,
      members: input.members,
      myShare,
      date: input.date,
      memo: input.memo || undefined,
      sourceRunId: input.sourceRunId,
      createdAt: Date.now(),
    });
    await bumpInventoryStock(input.itemName, myShare);
    return myShare;
  }

  /** Recomputes myShare from the patched total/partySize and reconciles the delta (or a full move, if itemName changed) against inventory. */
  async function updatePartyObtain(
    id: string,
    patch: Partial<
      Pick<
        PartyObtainEntry,
        "itemName" | "totalQuantity" | "partySize" | "members" | "date" | "memo"
      >
    >,
  ) {
    const existing = await db.partyObtains.get(id);
    if (!existing) return;
    const nextItemName = patch.itemName ?? existing.itemName;
    const nextTotal = patch.totalQuantity ?? existing.totalQuantity;
    const nextPartySize = patch.partySize ?? existing.partySize;
    const nextShare = partyShare(nextTotal, nextPartySize);
    if (nextItemName !== existing.itemName) {
      await bumpInventoryStock(existing.itemName, -existing.myShare);
      await bumpInventoryStock(nextItemName, nextShare);
    } else if (nextShare !== existing.myShare) {
      await bumpInventoryStock(existing.itemName, nextShare - existing.myShare);
    }
    await db.partyObtains.update(id, { ...patch, myShare: nextShare });
  }

  async function deletePartyObtain(id: string) {
    const entry = await db.partyObtains.get(id);
    if (!entry) return;
    await bumpInventoryStock(entry.itemName, -entry.myShare);
    await db.partyObtains.delete(id);
  }

  /** Re-inserts a previously-deleted entry as-is (same id) and re-applies its share to inventory — powers the "元に戻す" undo toast. */
  async function restorePartyObtain(record: PartyObtainEntry) {
    await db.partyObtains.add(record);
    await bumpInventoryStock(record.itemName, record.myShare);
  }

  async function setSettled(id: string, settled: boolean) {
    await db.partyObtains.update(id, { settled });
  }

  return {
    entries,
    addPartyObtain,
    updatePartyObtain,
    deletePartyObtain,
    restorePartyObtain,
    setSettled,
  };
}

/** A saved PT member name list — lets 販売/入手/MD進捗's member fields offer a pick list instead of retyping the same names every time. */
export function usePartyMembers() {
  const members = useLiveQuery(
    () => db.partyMembers.orderBy("name").toArray(),
    [],
    [] as PartyMember[],
  );

  async function addPartyMember(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = await db.partyMembers
      .where("name")
      .equals(trimmed)
      .first();
    if (existing) {
      if (existing.archived)
        await db.partyMembers.update(existing.id, { archived: false });
      return;
    }
    await db.partyMembers.add({
      id: newId(),
      name: trimmed,
      archived: false,
      createdAt: Date.now(),
    });
  }

  async function archivePartyMember(id: string, archived: boolean) {
    await db.partyMembers.update(id, { archived });
  }

  async function deletePartyMember(id: string) {
    await db.partyMembers.delete(id);
  }

  /** Re-inserts a previously-deleted member as-is (same id) — powers the "元に戻す" undo toast. */
  async function restorePartyMember(record: PartyMember) {
    await db.partyMembers.add(record);
  }

  return {
    members,
    addPartyMember,
    archivePartyMember,
    deletePartyMember,
    restorePartyMember,
  };
}
