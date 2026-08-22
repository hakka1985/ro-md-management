import { useState, type DragEvent, type FormEvent } from "react";
import { useWishlist } from "./useWishlist";
import { useTransactions, useDebts } from "../finance/useFinance";
import {
  getRealizedProfit,
  getWeeklyNetIncomeAverage,
  getOutstandingDebtBalance,
} from "../../lib/financeCalc";
import { formatZ, parseZeny } from "../../lib/zeny";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { ReorderButtons } from "../../components/ReorderButtons";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { WishlistItem } from "../../db/types";

function estimateAvailability(
  shortfall: number,
  weeklyAverage: number | null,
): string {
  if (shortfall <= 0) return "購入可能";
  if (weeklyAverage === null)
    return "収支データ不足（取引記録タブで記録すると見積りが出ます）";
  if (weeklyAverage <= 0) return "現在のペースでは見込み立たず";
  const weeksNeeded = Math.ceil(shortfall / weeklyAverage);
  return `約${weeksNeeded}週間で購入可能`;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function sortValue(i: WishlistItem, key: string): string | number {
  switch (key) {
    case "priority":
      return i.priority ?? 999;
    case "itemName":
      return i.itemName;
    case "quantity":
      return i.quantity;
    case "totalCost":
      return i.quantity * i.unitCost;
    default:
      return "";
  }
}

interface WishlistEditFormProps {
  item: WishlistItem;
  onSave: (patch: Partial<Omit<WishlistItem, "id" | "createdAt">>) => void;
  onClose: () => void;
}

export function WishlistEditForm({
  item,
  onSave,
  onClose,
}: WishlistEditFormProps) {
  const [itemName, setItemName] = useState(item.itemName);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(String(item.unitCost));
  const [memo, setMemo] = useState(item.memo ?? "");
  const [eventTag, setEventTag] = useState(item.eventTag ?? "");
  const [refineTarget, setRefineTarget] = useState(item.refineTarget ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const cost = parseZeny(unitCost);
    if (!itemName.trim() || Number.isNaN(qty) || qty <= 0 || cost < 0) return;
    const nextEventTag = eventTag.trim() || undefined;
    onSave({
      itemName: itemName.trim(),
      quantity: qty,
      unitCost: cost,
      memo: memo.trim() || undefined,
      eventTag: nextEventTag,
      refineTarget: refineTarget.trim() || undefined,
      // 個人の欲しい物リストに戻す（イベントタグを外す）場合、進捗数量は意味を
      // 持たなくなるので一緒にクリアする。
      obtainedQuantity: nextEventTag
        ? Math.min(item.obtainedQuantity ?? 0, qty)
        : undefined,
      achievedQuantity: nextEventTag ? (item.achievedQuantity ?? 0) : undefined,
    });
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>欲しいものを編集</h2>
      <label>
        アイテム名
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
      </label>
      <label>
        {eventTag.trim() ? "目標個数" : "欲しい数"}
        <input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </label>
      <label>
        {eventTag.trim() ? "仕入れ値上限" : "1個あたりの想定コスト"}
        <input
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          required
        />
      </label>
      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <label>
        イベント名（任意）
        <input
          placeholder="例: 2027精錬祭り"
          value={eventTag}
          onChange={(e) => setEventTag(e.target.value)}
        />
        <span className="hint">
          空にすると通常の欲しいものリストに戻ります（進捗はリセットされます）。
        </span>
      </label>
      {eventTag.trim() && (
        <label>
          目標精錬値（任意）
          <input
            placeholder="例: +7"
            value={refineTarget}
            onChange={(e) => setRefineTarget(e.target.value)}
          />
        </label>
      )}
      <div className="form-actions">
        <button type="submit">保存</button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function WishlistList() {
  const {
    items,
    setObtained,
    updateItem,
    deleteItem,
    restoreItem,
    reorderItem,
  } = useWishlist();
  const { showUndo } = useToast();
  const { transactions } = useTransactions();
  const { debts } = useDebts();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = items.find((i) => i.id === editingId) ?? null;

  const debtBalance = getOutstandingDebtBalance(debts);
  const outstandingBorrowed = debts
    .filter((d) => d.direction === "borrowed")
    .reduce((sum, d) => sum + (d.amount - d.repaidAmount), 0);
  // Borrowed money isn't really spendable (it has to be paid back), and
  // money lent out isn't available until recovered, so the affordability
  // estimate below has to net those against realized profit — otherwise a
  // wishlist item could look "affordable" using zeny that's already owed
  // to someone else.
  const currentBalance = getRealizedProfit(transactions) + debtBalance;
  const weeklyAverage = getWeeklyNetIncomeAverage(transactions);

  // イベントタグ付きアイテムは「イベント仕入れ計画」パネル（EventPrepPanel）
  // 側でグループ表示するので、通常の優先度リストからは除外する。
  const personalItems = items.filter((i) => !i.eventTag);
  const pending = personalItems.filter((i) => !i.obtained);
  const obtained = personalItems.filter((i) => i.obtained);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? pending.filter(
        (i) =>
          i.itemName.toLowerCase().includes(q) ||
          (i.memo ?? "").toLowerCase().includes(q),
      )
    : pending;
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  function moveUp(id: string) {
    const idx = sorted.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    reorderItem(id, sorted[idx - 1].id);
  }
  function moveDown(id: string) {
    const idx = sorted.findIndex((i) => i.id === id);
    if (idx === -1 || idx >= sorted.length - 1) return;
    reorderItem(id, sorted[idx + 1].id);
  }

  return (
    <section className="panel">
      <h2>欲しいものリスト</h2>
      <input
        placeholder="アイテム名・メモで検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", margin: "0.5rem 0" }}
      />
      <p className="hint">
        {sortKey
          ? "列見出しクリックで並び替え中はドラッグでの並び替えはできません（見出しをもう一度クリックして解除できます）。"
          : "行をドラッグすると優先度を並び替えられます。列見出しをクリックすると並び替えできます。"}
      </p>
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="優先度"
                sortKey="priority"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
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
                label="必要総額"
                sortKey="totalCost"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>見積り / メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {outstandingBorrowed > 0 && (
              <tr title="「貸し借り」タブで返済を記録すると減っていきます">
                <td>—</td>
                <td>
                  <strong>🔺 借りている金額の返済</strong>
                </td>
                <td>—</td>
                <td title={`${outstandingBorrowed.toLocaleString()} z`}>
                  {formatZ(outstandingBorrowed)}
                </td>
                <td>買い物より先に返すべき分です（「貸し借り」タブで記録）</td>
                <td>—</td>
              </tr>
            )}
            {sorted.map((item, index) => {
              const totalCost = item.quantity * item.unitCost;
              const shortfall = totalCost - currentBalance;
              return (
                <tr
                  key={item.id}
                  draggable={sortKey === null}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("wishlistId", item.id)
                  }
                  onDragOver={onDragOver}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragId = e.dataTransfer.getData("wishlistId");
                    if (dragId) reorderItem(dragId, item.id);
                  }}
                >
                  <td>{index + 1}</td>
                  <td style={{ textAlign: "left" }}>{item.itemName}</td>
                  <td>{item.quantity}</td>
                  <td
                    title={`${totalCost.toLocaleString()} z`}
                    draggable={false}
                  >
                    {formatZ(totalCost)}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    {estimateAvailability(shortfall, weeklyAverage)}
                    {item.memo && ` / ${item.memo}`}
                  </td>
                  <td>
                    <ReorderButtons
                      onMoveUp={() => moveUp(item.id)}
                      onMoveDown={() => moveDown(item.id)}
                      canMoveUp={sortKey === null && sorted[0]?.id !== item.id}
                      canMoveDown={
                        sortKey === null &&
                        sorted[sorted.length - 1]?.id !== item.id
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setObtained(item.id, true)}
                    >
                      入手済みにする
                    </button>
                    <button type="button" onClick={() => setEditingId(item.id)}>
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${item.itemName}」を欲しいものリストから削除しますか？`,
                          )
                        ) {
                          deleteItem(item.id);
                          showUndo(`「${item.itemName}」を削除しました`, () =>
                            restoreItem(item),
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
            {sorted.length === 0 && outstandingBorrowed === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {search
                    ? "一致するアイテムがありません"
                    : "欲しいものリストは空です"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {obtained.length > 0 && (
        <>
          <h3>入手済み</h3>
          <ul className="entity-list">
            {obtained.map((item) => (
              <li key={item.id} className="archived">
                <span className="entity-list-main">
                  {item.itemName} ×{item.quantity}
                </span>
                <span className="entity-list-actions">
                  <button
                    type="button"
                    onClick={() => setObtained(item.id, false)}
                  >
                    未入手に戻す
                  </button>
                  <button type="button" onClick={() => setEditingId(item.id)}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `「${item.itemName}」を欲しいものリストから削除しますか？`,
                        )
                      ) {
                        deleteItem(item.id);
                        showUndo(`「${item.itemName}」を削除しました`, () =>
                          restoreItem(item),
                        );
                      }
                    }}
                  >
                    削除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={editingItem !== null} onClose={() => setEditingId(null)}>
        {editingItem && (
          <WishlistEditForm
            item={editingItem}
            onSave={(patch) => {
              updateItem(editingItem.id, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </section>
  );
}
