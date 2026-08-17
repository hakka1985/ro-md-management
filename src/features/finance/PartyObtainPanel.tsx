import { useState, type FormEvent } from "react";
import { usePartyObtains, useItemPrices } from "./useFinance";
import { formatDateTime, isWithinDateRange } from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { PartyObtainEntry } from "../../db/types";

function sortValue(e: PartyObtainEntry, key: string): string | number {
  switch (key) {
    case "date":
      return e.date;
    case "itemName":
      return e.itemName;
    case "totalQuantity":
      return e.totalQuantity;
    case "partySize":
      return e.partySize;
    case "myShare":
      return e.myShare;
    default:
      return "";
  }
}

function parseMembers(input: string): string[] {
  return input
    .split(/[,、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface EditFormProps {
  entry: PartyObtainEntry;
  onSave: (patch: {
    itemName: string;
    totalQuantity: number;
    partySize: number;
    members: string[];
    memo?: string;
  }) => void;
  onClose: () => void;
}

function PartyObtainEditForm({ entry, onSave, onClose }: EditFormProps) {
  const [itemName, setItemName] = useState(entry.itemName);
  const [totalQuantity, setTotalQuantity] = useState(String(entry.totalQuantity));
  const [partySize, setPartySize] = useState(String(entry.partySize));
  const [membersInput, setMembersInput] = useState(entry.members.join(" "));
  const [memo, setMemo] = useState(entry.memo ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(totalQuantity);
    const party = Math.max(2, Number(partySize) || 2);
    if (!itemName.trim() || Number.isNaN(total) || total <= 0) return;
    onSave({
      itemName: itemName.trim(),
      totalQuantity: total,
      partySize: party,
      members: parseMembers(membersInput),
      memo: memo.trim() || undefined,
    });
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>PT入手を編集</h2>
      <label>
        アイテム名
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
      </label>
      <label>
        PTの合計入手数
        <input
          type="number"
          min="0.01"
          step="any"
          value={totalQuantity}
          onChange={(e) => setTotalQuantity(e.target.value)}
          required
        />
      </label>
      <label>
        PT人数
        <input
          type="number"
          min="2"
          step="1"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          required
        />
      </label>
      <label>
        PTメンバー（自分以外、任意）
        <input
          value={membersInput}
          onChange={(e) => setMembersInput(e.target.value)}
        />
      </label>
      <label>
        メモ（任意）
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

export function PartyObtainPanel() {
  const {
    entries,
    addPartyObtain,
    updatePartyObtain,
    deletePartyObtain,
    restorePartyObtain,
  } = usePartyObtains();
  const { itemPrices } = useItemPrices();
  const { showUndo } = useToast();

  const [itemName, setItemName] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [membersInput, setMembersInput] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeItems = (itemPrices ?? []).filter((p) => !p.archived);
  const editingEntry = entries.find((e) => e.id === editingId) ?? null;

  const filtered = entries
    .filter((e) => e.itemName.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((e) => isWithinDateRange(e.date, dateFrom, dateTo));
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, sortValue);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const name = itemName.trim();
    const total = Number(totalQuantity);
    const party = Math.max(2, Number(partySize) || 2);
    if (!name || Number.isNaN(total) || total <= 0) {
      setError("アイテム名と合計入手数を正しく入力してください。");
      return;
    }
    const members = parseMembers(membersInput);
    const myShare = await addPartyObtain({
      itemName: name,
      totalQuantity: total,
      partySize: party,
      members,
      date: Date.now(),
      memo: memo.trim() || undefined,
    });
    setMessage(
      `記録しました（PT${party}人で分配、自分の取り分 ${myShare}個を在庫に追加）。`,
    );
    setItemName("");
    setTotalQuantity("");
    setPartySize("2");
    setMembersInput("");
    setMemo("");
  }

  return (
    <section className="panel">
      <h2>PT入手</h2>
      <p className="hint">
        PTで山分けした入手（お金のやり取りがないもの）を1回ごとに記録します。合計入手数をPT人数で割った、自分の取り分だけが在庫に加算されます（取引記録には計上されません）。ソロで入手した分はこちらではなく「取引・在庫」の「入手」を使ってください。
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-message">{message}</p>}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          list="party-obtain-item-options"
          placeholder="アイテム名"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
        <datalist id="party-obtain-item-options">
          {activeItems.map((p) => (
            <option key={p.id} value={p.itemName} />
          ))}
        </datalist>
        <input
          type="number"
          min="0.01"
          step="any"
          placeholder="PTの合計入手数"
          title="PTで合計何個手に入ったか（分配前の総数）"
          value={totalQuantity}
          onChange={(e) => setTotalQuantity(e.target.value)}
          required
          style={{ width: "9rem" }}
        />
        <input
          type="number"
          min="2"
          step="1"
          placeholder="PT人数"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          required
          style={{ width: "6rem" }}
        />
        <input
          placeholder="PTメンバー（自分以外、任意）"
          value={membersInput}
          onChange={(e) => setMembersInput(e.target.value)}
        />
        <input
          placeholder="メモ（任意）"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button type="submit">記録する</button>
      </form>

      {entries.length > 0 && (
        <>
          <input
            placeholder="アイテム名で検索"
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
                    label="アイテム名"
                    sortKey="itemName"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="合計"
                    sortKey="totalQuantity"
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
                  <th>メンバー</th>
                  <SortableHeader
                    label="自分の取り分"
                    sortKey="myShare"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th>メモ</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.date)}</td>
                    <td style={{ textAlign: "left" }}>{entry.itemName}</td>
                    <td>{entry.totalQuantity}</td>
                    <td>{entry.partySize}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {entry.members.length > 0 ? entry.members.join("、") : "—"}
                    </td>
                    <td>{entry.myShare}</td>
                    <td style={{ whiteSpace: "normal" }}>{entry.memo || "—"}</td>
                    <td>
                      <button type="button" onClick={() => setEditingId(entry.id)}>
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `「${entry.itemName}」のPT入手記録を削除しますか？（在庫から自分の取り分${entry.myShare}個が引かれます）`,
                            )
                          ) {
                            const record = entry;
                            deletePartyObtain(entry.id);
                            showUndo(
                              `「${entry.itemName}」のPT入手記録を削除しました`,
                              () => restorePartyObtain(record),
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
                        ? "一致する記録がありません"
                        : "まだ記録がありません"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={editingEntry !== null} onClose={() => setEditingId(null)}>
        {editingEntry && (
          <PartyObtainEditForm
            entry={editingEntry}
            onSave={(patch) => {
              updatePartyObtain(editingEntry.id, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </section>
  );
}
