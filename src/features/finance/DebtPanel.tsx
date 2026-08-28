import { useState, type FormEvent } from "react";
import { useDebts } from "./useFinance";
import { parseZeny, formatZ } from "../../lib/zeny";
import {
  formatDateTime,
  isWithinDateRange,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { DebtDirection, DebtEntry } from "../../db/types";

function sortValue(d: DebtEntry, key: string): string | number {
  switch (key) {
    case "date":
      return d.date;
    case "direction":
      return d.direction;
    case "counterparty":
      return d.counterparty;
    case "amount":
      return d.amount;
    case "remaining":
      return d.amount - d.repaidAmount;
    default:
      return "";
  }
}

interface DebtEditFormProps {
  debt: DebtEntry;
  onSave: (patch: Partial<Omit<DebtEntry, "id" | "createdAt">>) => void;
  onClose: () => void;
}

function DebtEditForm({ debt, onSave, onClose }: DebtEditFormProps) {
  const [direction, setDirection] = useState<DebtDirection>(debt.direction);
  const [counterparty, setCounterparty] = useState(debt.counterparty);
  const [amountInput, setAmountInput] = useState(String(debt.amount));
  const [repaidInput, setRepaidInput] = useState(String(debt.repaidAmount));
  const [date, setDate] = useState(toDatetimeLocalValue(debt.date));
  const [memo, setMemo] = useState(debt.memo ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseZeny(amountInput);
    const repaidAmount = Math.min(parseZeny(repaidInput), amount);
    if (!counterparty.trim() || amount <= 0 || !date) return;
    onSave({
      direction,
      counterparty: counterparty.trim(),
      amount,
      repaidAmount,
      date: fromDatetimeLocalValue(date),
      memo: memo.trim() || undefined,
    });
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>貸し借りを編集</h2>
      <label className="checkbox-label">
        <input
          type="radio"
          checked={direction === "borrowed"}
          onChange={() => setDirection("borrowed")}
        />
        借りた
      </label>
      <label className="checkbox-label">
        <input
          type="radio"
          checked={direction === "lent"}
          onChange={() => setDirection("lent")}
        />
        貸した
      </label>
      <label>
        相手
        <input
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          required
        />
      </label>
      <label>
        金額
        <input
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          required
        />
      </label>
      <label>
        返済/回収済み額（修正用）
        <input
          value={repaidInput}
          onChange={(e) => setRepaidInput(e.target.value)}
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

export function DebtPanel() {
  const { debts, addDebt, addRepayment, updateDebt, deleteDebt, restoreDebt } =
    useDebts();
  const { showUndo } = useToast();

  const [direction, setDirection] = useState<DebtDirection>("borrowed");
  const [counterparty, setCounterparty] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [memo, setMemo] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [repaymentInputs, setRepaymentInputs] = useState<
    Record<string, string>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editingDebt = (debts ?? []).find((d) => d.id === editingId) ?? null;

  const filtered = (debts ?? [])
    .filter((d) =>
      d.counterparty.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .filter((d) => isWithinDateRange(d.date, dateFrom, dateTo));
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  const outstandingBorrowed = (debts ?? [])
    .filter((d) => d.direction === "borrowed")
    .reduce((sum, d) => sum + (d.amount - d.repaidAmount), 0);
  const outstandingLent = (debts ?? [])
    .filter((d) => d.direction === "lent")
    .reduce((sum, d) => sum + (d.amount - d.repaidAmount), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const amount = parseZeny(amountInput);
    if (!counterparty.trim() || amount <= 0) return;
    setSubmitting(true);
    try {
      await addDebt({
        direction,
        counterparty: counterparty.trim(),
        amount,
        date: Date.now(),
        memo: memo.trim(),
      });
      setCounterparty("");
      setAmountInput("");
      setMemo("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRepay(id: string) {
    const value = repaymentInputs[id] ?? "";
    const amount = parseZeny(value);
    if (amount <= 0) return;
    await addRepayment(id, amount);
    setRepaymentInputs((prev) => ({ ...prev, [id]: "" }));
  }

  return (
    <section className="panel">
      <h2>貸し借り</h2>
      <p className="hint">
        知り合いとのzenyの貸し借りを記録します。取引記録（実績利益）には計上されず、
        未返済・未回収の残額だけがダッシュボードの合計資産に反映されます（借りた分はマイナス、
        貸した分はプラス）。所持金の増減は「キャラクター管理」で別途手動編集してください。
      </p>
      <ul className="stat-list">
        <li title={`${outstandingBorrowed.toLocaleString()} z`}>
          借りている合計（未返済）: {formatZ(outstandingBorrowed)}
        </li>
        <li title={`${outstandingLent.toLocaleString()} z`}>
          貸している合計（未回収）: {formatZ(outstandingLent)}
        </li>
      </ul>

      <form className="inline-form" onSubmit={handleSubmit}>
        <label className="checkbox-label">
          <input
            type="radio"
            checked={direction === "borrowed"}
            onChange={() => setDirection("borrowed")}
          />
          借りた
        </label>
        <label className="checkbox-label">
          <input
            type="radio"
            checked={direction === "lent"}
            onChange={() => setDirection("lent")}
          />
          貸した
        </label>
        <input
          placeholder="相手（キャラ名など）"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          required
        />
        <input
          placeholder="金額（例: 10M）"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          required
        />
        <input
          placeholder="メモ（任意）"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          記録する
        </button>
      </form>

      <input
        placeholder="相手の名前で検索"
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
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="日時"
                sortKey="date"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="方向"
                sortKey="direction"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="相手"
                sortKey="counterparty"
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
                label="残額"
                sortKey="remaining"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>メモ</th>
              <th>返済/回収を記録</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const remaining = d.amount - d.repaidAmount;
              const settled = remaining <= 0;
              return (
                <tr key={d.id} className={settled ? "archived" : ""}>
                  <td>{formatDateTime(d.date)}</td>
                  <td>{d.direction === "borrowed" ? "借りた" : "貸した"}</td>
                  <td>{d.counterparty}</td>
                  <td title={`${d.amount.toLocaleString()} z`}>
                    {formatZ(d.amount)}
                  </td>
                  <td title={`${remaining.toLocaleString()} z`}>
                    {settled ? "完済" : formatZ(remaining)}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>{d.memo || "—"}</td>
                  <td>
                    {!settled && (
                      <div className="inline-form" style={{ gap: "0.3rem" }}>
                        <input
                          placeholder="例: 5M"
                          value={repaymentInputs[d.id] ?? ""}
                          onChange={(e) =>
                            setRepaymentInputs((prev) => ({
                              ...prev,
                              [d.id]: e.target.value,
                            }))
                          }
                          style={{ width: "6rem" }}
                        />
                        <button type="button" onClick={() => handleRepay(d.id)}>
                          記録
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => setEditingId(d.id)}>
                      編集
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${d.counterparty}」との貸し借り記録を削除しますか？`,
                          )
                        ) {
                          deleteDebt(d.id);
                          showUndo(
                            `「${d.counterparty}」との記録を削除しました`,
                            () => restoreDebt(d),
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
                <td colSpan={8} className="empty">
                  {search || dateFrom || dateTo
                    ? "一致する貸し借り記録がありません"
                    : "まだ貸し借り記録がありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={editingDebt !== null} onClose={() => setEditingId(null)}>
        {editingDebt && (
          <DebtEditForm
            debt={editingDebt}
            onSave={(patch) => {
              updateDebt(editingDebt.id, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </section>
  );
}
