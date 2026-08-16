import { useState } from "react";
import { useMvpKills, useMvpMaster } from "./useMvp";
import { useCharacters } from "../characters/useCharacters";
import { formatDateTime, isWithinDateRange } from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { useToast } from "../../components/toastContext";
import type { MvpKill } from "../../db/types";

interface Props {
  onEdit: (kill: MvpKill) => void;
}

interface KillRow {
  kill: MvpKill;
  mvpName: string;
  characterName: string;
}

function sortValue(row: KillRow, key: string): string | number {
  switch (key) {
    case "date":
      return row.kill.killedAt;
    case "mvpName":
      return row.mvpName;
    case "characterName":
      return row.characterName;
    case "card":
      return row.kill.cardDropped ? 1 : 0;
    case "items":
      return row.kill.itemsDropped?.length ?? 0;
    default:
      return "";
  }
}

export function MvpKillList({ onEdit }: Props) {
  const { kills, deleteKill, restoreKill } = useMvpKills();
  const { showUndo } = useToast();
  const { mvpMaster } = useMvpMaster();
  const { characters } = useCharacters();

  const mvpNameById = new Map((mvpMaster ?? []).map((m) => [m.id, m.name]));
  const characterNameById = new Map(
    (characters ?? []).map((c) => [c.id, c.name]),
  );

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows: KillRow[] = (kills ?? []).map((kill) => ({
    kill,
    mvpName: mvpNameById.get(kill.mvpId) ?? "（不明なMVP）",
    characterName: kill.characterId
      ? characterNameById.get(kill.characterId) ?? ""
      : "",
  }));

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(
      (r) =>
        !q ||
        r.mvpName.toLowerCase().includes(q) ||
        r.characterName.toLowerCase().includes(q) ||
        (r.kill.cardName ?? "").toLowerCase().includes(q) ||
        (r.kill.itemsDropped ?? []).some((n) =>
          n.toLowerCase().includes(q),
        ) ||
        (r.kill.memo ?? "").toLowerCase().includes(q),
    )
    .filter((r) => isWithinDateRange(r.kill.killedAt, dateFrom, dateTo));

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  return (
    <section className="panel">
      <h2>討伐履歴</h2>
      <input
        placeholder="MVP名・キャラ・カード名・アイテム名・メモで検索"
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
                label="MVP名"
                sortKey="mvpName"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="キャラ"
                sortKey="characterName"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="カード"
                sortKey="card"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="アイテム"
                sortKey="items"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ kill: k, mvpName, characterName }) => (
              <tr key={k.id}>
                <td>{formatDateTime(k.killedAt)}</td>
                <td>{mvpName}</td>
                <td>{characterName || "—"}</td>
                <td>{k.cardDropped ? `🃏 ${k.cardName ?? "カード"}` : "—"}</td>
                <td style={{ whiteSpace: "normal" }}>
                  {k.itemsDropped && k.itemsDropped.length > 0
                    ? `🎁 ${k.itemsDropped.join("、")}`
                    : "—"}
                </td>
                <td style={{ whiteSpace: "normal" }}>{k.memo || "—"}</td>
                <td>
                  <button type="button" onClick={() => onEdit(k)}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("この討伐記録を削除しますか？")) {
                        deleteKill(k.id);
                        showUndo("討伐記録を削除しました", () => restoreKill(k));
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
                <td colSpan={7} className="empty">
                  {search || dateFrom || dateTo
                    ? "一致する討伐記録がありません"
                    : "まだ討伐記録がありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
