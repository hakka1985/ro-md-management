import { useState } from "react";
import { useMdDungeons, useMdRuns } from "./useMd";
import { useCharacters } from "../characters/useCharacters";
import {
  formatDateTime,
  formatClearTime,
  isWithinDateRange,
} from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { useToast } from "../../components/toastContext";
import type { MdRun } from "../../db/types";

interface Props {
  onEdit: (run: MdRun) => void;
}

interface RunRow {
  run: MdRun;
  dungeonName: string;
  characterName: string;
  defeatedText: string;
  itemsText: string;
  partyText: string;
  recordText: string;
}

function sortValue(row: RunRow, key: string): string | number {
  switch (key) {
    case "date":
      return row.run.completedAt;
    case "dungeonName":
      return row.dungeonName;
    case "characterName":
      return row.characterName;
    case "clearTime":
      return row.run.clearTimeSeconds ?? -1;
    default:
      return "";
  }
}

export function MdRunList({ onEdit }: Props) {
  const { runs, deleteRun, restoreRun } = useMdRuns();
  const { showUndo } = useToast();
  const { dungeons } = useMdDungeons();
  const { characters } = useCharacters();

  const dungeonNameById = new Map((dungeons ?? []).map((d) => [d.id, d.name]));
  const characterNameById = new Map(
    (characters ?? []).map((c) => [c.id, c.name]),
  );

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows: RunRow[] = (runs ?? []).map((run) => {
    const defeated = Object.entries(run.mvpDefeats)
      .filter(([, v]) => v)
      .map(([name]) => name);
    const defeatedText =
      Object.keys(run.mvpDefeats).length === 0
        ? ""
        : defeated.length > 0
          ? defeated.join("、")
          : "討伐なし";
    const itemsText = Object.entries(run.items ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => `${name}×${qty}`)
      .join("、");
    const partyText =
      run.partySize && run.partySize > 1 ? `PT${run.partySize}人` : "";
    const recordParts = [
      run.score !== undefined ? `得点${run.score}` : null,
      run.rooms !== undefined ? `部屋${run.rooms}` : null,
    ].filter((p): p is string => p !== null);
    const recordText = recordParts.join("・");
    return {
      run,
      dungeonName: dungeonNameById.get(run.dungeonId) ?? "（不明なMD）",
      characterName: characterNameById.get(run.characterId) ?? "",
      defeatedText,
      itemsText,
      partyText,
      recordText,
    };
  });

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(
      (r) =>
        !q ||
        r.dungeonName.toLowerCase().includes(q) ||
        r.characterName.toLowerCase().includes(q) ||
        (r.run.modeName ?? "").toLowerCase().includes(q) ||
        (r.run.memo ?? "").toLowerCase().includes(q) ||
        r.itemsText.toLowerCase().includes(q),
    )
    .filter((r) => isWithinDateRange(r.run.completedAt, dateFrom, dateTo));

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  return (
    <section className="panel">
      <h2>周回履歴</h2>
      <input
        placeholder="MD名・キャラ・アイテム名・メモで検索"
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
                label="MD名"
                sortKey="dungeonName"
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
              <th>討伐</th>
              <th>獲得アイテム</th>
              <th>PT人数</th>
              <th>得点/部屋数</th>
              <SortableHeader
                label="クリア時間"
                sortKey="clearTime"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ run: r, dungeonName, characterName, defeatedText, itemsText, partyText, recordText }) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.completedAt)}</td>
                <td>
                  {dungeonName}
                  {r.modeName && (
                    <span className="entity-list-sub"> / {r.modeName}</span>
                  )}
                </td>
                <td>{characterName}</td>
                <td>{defeatedText || "—"}</td>
                <td style={{ whiteSpace: "normal" }}>{itemsText || "—"}</td>
                <td>{partyText || "—"}</td>
                <td>{recordText || "—"}</td>
                <td>
                  {r.clearTimeSeconds !== undefined
                    ? formatClearTime(r.clearTimeSeconds)
                    : "—"}
                  {r.isNewRecord && (
                    <span
                      className="entity-list-sub"
                      title="この周回の時点で、このMDの最高記録を更新しました（得点→部屋数→クリア時間の優先順で判定）"
                    >
                      {" "}
                      🏆新記録
                    </span>
                  )}
                </td>
                <td style={{ whiteSpace: "normal" }}>{r.memo || "—"}</td>
                <td>
                  <button type="button" onClick={() => onEdit(r)}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "この周回記録を削除しますか？（在庫は連動して変更されません）",
                        )
                      ) {
                        deleteRun(r.id);
                        showUndo("周回記録を削除しました", () => restoreRun(r));
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
                <td colSpan={10} className="empty">
                  {search || dateFrom || dateTo
                    ? "一致する周回記録がありません"
                    : "まだ周回記録がありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
