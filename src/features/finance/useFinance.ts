import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type {
  ItemPrice,
  InventoryItem,
  FinanceTransaction,
  FinanceSource,
  DebtEntry,
  DebtDirection,
} from "../../db/types";

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

  return { inventory, addStock, removeStock, setStock };
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

  async function deleteDebt(id: string) {
    await db.debts.delete(id);
  }

  /** Re-inserts a previously-deleted debt as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreDebt(record: DebtEntry) {
    await db.debts.add(record);
  }

  return { debts, addDebt, addRepayment, deleteDebt, restoreDebt };
}
