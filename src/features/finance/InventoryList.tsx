import { useState } from "react";
import { useInventory, useItemPrices, useTransactions } from "./useFinance";
import { parseZeny, formatZ } from "../../lib/zeny";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { useToast } from "../../components/toastContext";
import type { InventoryItem } from "../../db/types";

const STALE_DAYS = 14;

export function InventoryList() {
  const {
    inventory,
    setStock,
    updateInventoryMemo,
    deleteInventoryItem,
    restoreInventoryItem,
  } = useInventory();
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { transactions } = useTransactions();
  const { showUndo } = useToast();
  const [search, setSearch] = useState("");

  const priceByName = new Map(
    (itemPrices ?? []).map((p) => [p.itemName, p.expectedPrice]),
  );
  const lastSoldByName = new Map<string, number>();
  for (const t of transactions ?? []) {
    if (t.type !== "income") continue;
    const prev = lastSoldByName.get(t.itemName);
    if (prev === undefined || t.date > prev) lastSoldByName.set(t.itemName, t.date);
  }
  const inStockAll = (inventory ?? []).filter((i) => i.quantity > 0);
  // "売り時" cutoff scales to the account's own economy instead of a fixed
  // zeny amount — the top quartile of currently-held evaluated values.
  const positiveValues = inStockAll
    .map((i) => i.quantity * (priceByName.get(i.itemName) ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  const highValueCutoff =
    positiveValues[Math.max(0, Math.ceil(positiveValues.length * 0.25) - 1)] ?? 0;
  const now = Date.now();
  function staleDays(itemName: string): number | null {
    const lastSold = lastSoldByName.get(itemName);
    if (lastSold === undefined) return null;
    return (now - lastSold) / (24 * 60 * 60 * 1000);
  }
  function isSellAlert(i: InventoryItem): boolean {
    const price = priceByName.get(i.itemName) ?? 0;
    const value = i.quantity * price;
    if (value <= 0 || value < highValueCutoff) return false;
    const days = staleDays(i.itemName);
    return days === null || days >= STALE_DAYS;
  }
  const inStock = inStockAll.filter((i) =>
    i.itemName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function sortValue(i: InventoryItem, key: string): string | number {
    const price = priceByName.get(i.itemName) ?? 0;
    switch (key) {
      case "itemName":
        return i.itemName;
      case "quantity":
        return i.quantity;
      case "price":
        return price;
      case "value":
        return i.quantity * price;
      default:
        return "";
    }
  }
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    inStock,
    sortValue,
  );

  function handleQuantityBlur(itemName: string, value: string) {
    const qty = Number(value);
    if (Number.isNaN(qty) || qty < 0) return;
    setStock(itemName, qty);
  }

  function handlePriceBlur(itemName: string, value: string) {
    upsertItemPrice({ itemName, expectedPrice: parseZeny(value) });
  }

  function handleMemoBlur(id: string, value: string) {
    updateInventoryMemo(id, value.trim());
  }

  return (
    <section className="panel">
      <h2>在庫一覧</h2>
      <p className="hint">
        数量・想定単価・メモ欄を直接書き換えると、取引履歴を増やさずに更新できます。
        🔥は評価額が高いのに{STALE_DAYS}日以上売れていない（または一度も売っていない）在庫です。売り時かもしれません。
        間違って登録した行は「削除」で取り消せます（取引履歴・アイテムマスタには影響しません）。
        PTで山分けした入手は、記録時にPT人数を2人以上にすると「PT在庫一覧」に内訳が残ります。
      </p>
      <input
        placeholder="アイテム名で検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", margin: "0.5rem 0" }}
      />
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="アイテム名"
                sortKey="itemName"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="数量"
                sortKey="quantity"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="想定単価"
                sortKey="price"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="評価額"
                sortKey="value"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => {
              const price = priceByName.get(i.itemName) ?? 0;
              const days = staleDays(i.itemName);
              return (
                <tr key={i.id}>
                  <td style={{ textAlign: "left" }}>
                    {i.itemName}
                    {isSellAlert(i) && (
                      <span
                        className="entity-list-sub"
                        title={
                          days === null
                            ? "一度も売却記録がありません"
                            : `最後に売却してから約${Math.floor(days)}日経過しています`
                        }
                      >
                        {" "}
                        🔥売り時
                      </span>
                    )}
                  </td>
                  <td>
                    <input
                      key={i.quantity}
                      type="number"
                      min="0"
                      step="any"
                      title="PT分配で端数（例: 0.25個）になることがあります"
                      defaultValue={i.quantity}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={(e) =>
                        handleQuantityBlur(i.itemName, e.target.value)
                      }
                      style={{ width: "4.5rem" }}
                    />
                  </td>
                  <td>
                    <input
                      key={price}
                      defaultValue={price.toLocaleString()}
                      onBlur={(e) =>
                        handlePriceBlur(i.itemName, e.target.value)
                      }
                      style={{ width: "6rem" }}
                    />
                  </td>
                  <td title={`${(i.quantity * price).toLocaleString()} z`}>
                    {formatZ(i.quantity * price)}
                  </td>
                  <td>
                    <input
                      key={i.memo ?? ""}
                      defaultValue={i.memo ?? ""}
                      placeholder="—"
                      onBlur={(e) => handleMemoBlur(i.id, e.target.value)}
                      style={{ width: "10rem" }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${i.itemName}」を在庫一覧から削除しますか？（取引履歴・アイテムマスタからは削除されません）`,
                          )
                        ) {
                          const record = i;
                          deleteInventoryItem(i.id);
                          showUndo(`「${i.itemName}」を削除しました`, () =>
                            restoreInventoryItem(record),
                          );
                        }
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {search ? "一致するアイテムがありません" : "在庫はありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
