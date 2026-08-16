import { useState, type FormEvent } from "react";
import { useTransactions } from "./useFinance";
import {
  formatDateTime,
  isWithinDateRange,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from "../../lib/date";
import { formatZ } from "../../lib/zeny";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { FinanceTransaction } from "../../db/types";

function sortValue(t: FinanceTransaction, key: string): string | number {
  switch (key) {
    case "date":
      return t.date;
    case "itemName":
      return t.itemName;
    case "type":
      return t.type;
    case "amount":
      return t.amount;
    case "quantity":
      return t.quantity;
    case "partySize":
      return t.partySize ?? 0;
    default:
      return "";
  }
}

interface EditFormProps {
  transaction: FinanceTransaction;
  onSave: (patch: Partial<Omit<FinanceTransaction, "id" | "createdAt">>) => void;
  onClose: () => void;
}

/** Editable via a modal form so CSV精算表インポート由来の行（内容が実アイテム名ではない）も後から修正できる。全取引記録で共通に使う。 */
function TransactionEditForm({ transaction, onSave, onClose }: EditFormProps) {
  const [type, setType] = useState<"income" | "expense">(transaction.type);
  const [itemName, setItemName] = useState(transaction.itemName);
  const [quantity, setQuantity] = useState(String(transaction.quantity));
  const [unitPrice, setUnitPrice] = useState(String(transaction.unitPrice));
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(toDatetimeLocalValue(transaction.date));
  const [isEventIncome, setIsEventIncome] = useState(
    transaction.isEventIncome ?? false,
  );
  const [tagsInput, setTagsInput] = useState(
    (transaction.tags ?? []).join(" "),
  );
  const [memo, setMemo] = useState(transaction.memo ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    const u = Number(unitPrice);
    const a = Number(amount);
    if (
      !itemName.trim() ||
      Number.isNaN(q) ||
      Number.isNaN(u) ||
      Number.isNaN(a) ||
      !date
    )
      return;
    const tags = tagsInput
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      type,
      itemName: itemName.trim(),
      quantity: q,
      unitPrice: u,
      amount: a,
      date: fromDatetimeLocalValue(date),
      isEventIncome: type === "income" ? isEventIncome : undefined,
      tags: tags.length > 0 ? tags : undefined,
      memo: memo.trim() || undefined,
    });
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>取引記録を編集</h2>
      <label>
        種別
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "income" | "expense")}
        >
          <option value="income">売却（収入）</option>
          <option value="expense">購入（支出）</option>
        </select>
      </label>
      <label>
        アイテム名／内容
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
      </label>
      <label>
        数量
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label>
        単価
        <input
          type="number"
          min="0"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
      </label>
      <label>
        金額（合計）
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        日時
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      {type === "income" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isEventIncome}
            onChange={(e) => setIsEventIncome(e.target.checked)}
          />
          一時的な収入（イベント等、欲しいものリストの週平均収入見積りから除外）
        </label>
      )}
      <label>
        タグ（任意、スペース・カンマ区切りで複数可）
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
      </label>
      <label>
        メモ
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className="form-actions">
        <button type="submit">保存</button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function TransactionList() {
  const { transactions, updateTransaction, deleteTransaction, restoreTransaction } =
    useTransactions();
  const { showUndo } = useToast();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTransaction =
    (transactions ?? []).find((t) => t.id === editingId) ?? null;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = (transactions ?? [])
    .filter(
      (t) =>
        !q ||
        t.itemName.toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    )
    .filter((t) => isWithinDateRange(t.date, dateFrom, dateTo));
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === sorted.length ? new Set() : new Set(sorted.map((t) => t.id)),
    );
  }

  function handleBulkDelete() {
    const targets = (transactions ?? []).filter((t) => selectedIds.has(t.id));
    if (targets.length === 0) return;
    if (
      !window.confirm(`選択中の${targets.length}件を削除しますか？`)
    )
      return;
    for (const t of targets) deleteTransaction(t.id);
    setSelectedIds(new Set());
    showUndo(`${targets.length}件を削除しました`, () => {
      for (const t of targets) restoreTransaction(t);
    });
  }

  function handleBulkTag() {
    const tagsToAdd = bulkTagInput
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tagsToAdd.length === 0) return;
    const targets = (transactions ?? []).filter((t) => selectedIds.has(t.id));
    for (const t of targets) {
      const nextTags = [...new Set([...(t.tags ?? []), ...tagsToAdd])];
      updateTransaction(t.id, { tags: nextTags });
    }
    setBulkTagInput("");
    setSelectedIds(new Set());
  }

  return (
    <section className="panel">
      <h2>取引履歴</h2>
      <input
        placeholder="アイテム名・タグで検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", margin: "0.5rem 0" }}
      />
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
      />
      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <span>選択中: {selectedIds.size}件</span>
          <input
            placeholder="一括で付けるタグ"
            value={bulkTagInput}
            onChange={(e) => setBulkTagInput(e.target.value)}
            style={{ width: "10rem" }}
          />
          <button type="button" onClick={handleBulkTag}>
            タグを一括付与
          </button>
          <button type="button" onClick={handleBulkDelete}>
            選択を一括削除
          </button>
          <button type="button" onClick={() => setSelectedIds(new Set())}>
            選択解除
          </button>
        </div>
      )}
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    sorted.length > 0 && selectedIds.size === sorted.length
                  }
                  onChange={toggleSelectAll}
                  title="すべて選択"
                />
              </th>
              <SortableHeader
                label="日時"
                sortKey="date"
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
                label="種別"
                sortKey="type"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="金額"
                sortKey="amount"
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
                label="PT人数"
                sortKey="partySize"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelected(t.id)}
                  />
                </td>
                <td>{formatDateTime(t.date)}</td>
                <td>
                  {t.itemName}
                  {t.isEventIncome && (
                    <span
                      className="entity-list-sub"
                      title="一時的な収入（イベント等）として、欲しいものリストの週平均収入見積りから除外されます"
                    >
                      {" "}
                      🎪一時収入
                    </span>
                  )}
                  {t.tags && t.tags.length > 0 && (
                    <span className="entity-list-sub"> 🏷{t.tags.join(" ")}</span>
                  )}
                </td>
                <td>{t.type === "income" ? "売却" : "購入"}</td>
                <td title={`${t.amount.toLocaleString()} z`}>
                  {formatZ(t.amount)}
                </td>
                <td>{t.quantity}</td>
                <td>{t.partySize && t.partySize > 1 ? t.partySize : "—"}</td>
                <td>
                  <button type="button" onClick={() => setEditingId(t.id)}>
                    編集
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `「${t.itemName}」の取引記録を削除しますか？（在庫は連動して変更されません）`,
                        )
                      ) {
                        deleteTransaction(t.id);
                        showUndo(`「${t.itemName}」を削除しました`, () =>
                          restoreTransaction(t),
                        );
                      }
                    }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  {search || dateFrom || dateTo
                    ? "一致する取引記録がありません"
                    : "まだ取引記録がありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={editingTransaction !== null} onClose={() => setEditingId(null)}>
        {editingTransaction && (
          <TransactionEditForm
            transaction={editingTransaction}
            onSave={(patch) => {
              updateTransaction(editingTransaction.id, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </section>
  );
}
