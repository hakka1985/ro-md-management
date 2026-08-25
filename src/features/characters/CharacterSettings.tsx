import { useState, type DragEvent, type FormEvent } from "react";
import { useCharacters } from "./useCharacters";
import { useAppSettings } from "../settings/useAppSettings";
import { parseZeny } from "../../lib/zeny";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { ReorderButtons } from "../../components/ReorderButtons";
import type { Character } from "../../db/types";

const NEW_SERVER_OPTION = "__new__";
const NEW_ACCOUNT_OPTION = "__new__";

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function sortValue(c: Character, key: string): string | number {
  switch (key) {
    case "name":
      return c.name;
    case "server":
      return c.server;
    case "account":
      return c.account ?? "";
    case "level":
      return c.level ?? -1;
    case "jobLevel":
      return c.jobLevel ?? -1;
    case "job":
      return c.job ?? "";
    case "money":
      return c.money ?? 0;
    default:
      return "";
  }
}

export function CharacterSettings() {
  const {
    characters,
    addCharacter,
    updateCharacter,
    archiveCharacter,
    deleteCharacter,
    reorderCharacter,
    togglePinned,
  } = useCharacters();
  const { maxBaseLevel, maxJobLevel } = useAppSettings();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [serverIsNew, setServerIsNew] = useState(false);
  const [account, setAccount] = useState("");
  const [accountIsNew, setAccountIsNew] = useState(false);
  const [level, setLevel] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  const [job, setJob] = useState("");
  const [money, setMoney] = useState("");

  const knownServers = [
    ...new Set((characters ?? []).map((c) => c.server).filter(Boolean)),
  ].sort();
  const knownAccounts = [
    ...new Set(
      (characters ?? []).map((c) => c.account).filter((a): a is string => !!a),
    ),
  ].sort();

  const filtered = (characters ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.server.toLowerCase().includes(q) ||
      (c.account ?? "").toLowerCase().includes(q)
    );
  });
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  function handleServerSelectChange(value: string) {
    if (value === NEW_SERVER_OPTION) {
      setServerIsNew(true);
      setServer("");
    } else {
      setServerIsNew(false);
      setServer(value);
    }
  }

  function handleAccountSelectChange(value: string) {
    if (value === NEW_ACCOUNT_OPTION) {
      setAccountIsNew(true);
      setAccount("");
    } else {
      setAccountIsNew(false);
      setAccount(value);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !server.trim()) return;
    const lv = Number(level);
    const jlv = Number(jobLevel);
    await addCharacter({
      name: name.trim(),
      server: server.trim(),
      account: account.trim() || undefined,
      job: job.trim(),
      level: level.trim() && !Number.isNaN(lv) ? lv : undefined,
      jobLevel: jobLevel.trim() && !Number.isNaN(jlv) ? jlv : undefined,
      money: money.trim() ? parseZeny(money) : undefined,
    });
    setName("");
    setServer("");
    setServerIsNew(false);
    setAccount("");
    setAccountIsNew(false);
    setLevel("");
    setJobLevel("");
    setJob("");
    setMoney("");
  }

  function handleMoneyBlur(id: string, value: string) {
    updateCharacter(id, { money: value.trim() ? parseZeny(value) : 0 });
  }

  function handleAccountBlur(id: string, value: string) {
    updateCharacter(id, { account: value.trim() || undefined });
  }

  function handleLevelBlur(id: string, value: string) {
    const lv = Number(value);
    updateCharacter(id, {
      level: value.trim() && !Number.isNaN(lv) ? lv : undefined,
    });
  }

  function handleJobLevelBlur(id: string, value: string) {
    const jlv = Number(value);
    updateCharacter(id, {
      jobLevel: value.trim() && !Number.isNaN(jlv) ? jlv : undefined,
    });
  }

  function onDragStartRow(e: DragEvent, id: string) {
    e.dataTransfer.setData("characterId", id);
  }
  function onDropRow(e: DragEvent, dropId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("characterId");
    if (id) reorderCharacter(id, dropId);
  }

  function moveUp(id: string) {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx <= 0) return;
    reorderCharacter(id, sorted[idx - 1].id);
  }
  function moveDown(id: string) {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1 || idx >= sorted.length - 1) return;
    reorderCharacter(id, sorted[idx + 1].id);
  }

  return (
    <section className="panel">
      <h2>キャラクター管理</h2>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          placeholder="キャラクター名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {knownServers.length > 0 && !serverIsNew ? (
          <select
            value={server}
            onChange={(e) => handleServerSelectChange(e.target.value)}
          >
            <option value="" disabled>
              サーバーを選択
            </option>
            {knownServers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={NEW_SERVER_OPTION}>＋新しいサーバー名</option>
          </select>
        ) : (
          <input
            placeholder="サーバー"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            required
          />
        )}
        {knownServers.length > 0 && serverIsNew && (
          <button
            type="button"
            onClick={() => handleServerSelectChange(knownServers[0])}
          >
            既存から選ぶ
          </button>
        )}
        {knownAccounts.length > 0 && !accountIsNew ? (
          <select
            value={account}
            onChange={(e) => handleAccountSelectChange(e.target.value)}
          >
            <option value="">アカウント（任意）</option>
            {knownAccounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value={NEW_ACCOUNT_OPTION}>＋新しいアカウント名</option>
          </select>
        ) : (
          <input
            placeholder="アカウント（任意）"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
        )}
        {knownAccounts.length > 0 && accountIsNew && (
          <button
            type="button"
            onClick={() => handleAccountSelectChange("")}
          >
            既存から選ぶ
          </button>
        )}
        <input
          type="number"
          min="1"
          placeholder="Lv（任意）"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          style={{ width: "5.5rem" }}
        />
        <input
          type="number"
          min="1"
          placeholder="JLv（任意）"
          value={jobLevel}
          onChange={(e) => setJobLevel(e.target.value)}
          style={{ width: "5.5rem" }}
        />
        <input
          placeholder="職業（任意）"
          value={job}
          onChange={(e) => setJob(e.target.value)}
        />
        <input
          placeholder="所持金（任意、例: 10k）"
          value={money}
          onChange={(e) => setMoney(e.target.value)}
          style={{ width: "9rem" }}
        />
        <button type="submit">追加</button>
      </form>

      <input
        placeholder="キャラ名・サーバー・アカウントで検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", margin: "0.75rem 0" }}
      />
      <p className="hint">
        {sortKey
          ? "列見出しクリックで並び替え中はドラッグでの並び替えはできません（見出しをもう一度クリックして解除できます）。"
          : "行をドラッグすると並び替えられます。列見出しをクリックすると並び替えできます。"}
      </p>

      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="キャラ名"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="サーバー"
                sortKey="server"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="アカウント"
                sortKey="account"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Lv"
                sortKey="level"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="JLv"
                sortKey="jobLevel"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="職業"
                sortKey="job"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="所持金"
                sortKey="money"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.id}
                className={c.archived ? "archived" : ""}
                draggable={sortKey === null}
                onDragStart={(e) => onDragStartRow(e, c.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDropRow(e, c.id)}
              >
                <td style={{ textAlign: "left" }}>
                  <button
                    type="button"
                    className={c.pinned ? "pin-button pinned" : "pin-button"}
                    onClick={() => togglePinned(c.id, !c.pinned)}
                    title={c.pinned ? "ピン留めを解除" : "ピン留めして上位固定表示"}
                    draggable={false}
                  >
                    {c.pinned ? "★" : "☆"}
                  </button>
                  {c.name}
                  {c.mdExcluded && (
                    <span className="entity-list-sub"> (MD対象外)</span>
                  )}
                </td>
                <td>{c.server}</td>
                <td>
                  <input
                    key={c.account}
                    defaultValue={c.account ?? ""}
                    placeholder="—"
                    onBlur={(e) => handleAccountBlur(c.id, e.target.value)}
                    style={{ width: "6rem" }}
                  />
                </td>
                <td
                  className={
                    maxBaseLevel !== null && c.level === maxBaseLevel
                      ? "level-capped"
                      : ""
                  }
                >
                  <input
                    key={c.level}
                    type="number"
                    min="1"
                    defaultValue={c.level ?? ""}
                    onBlur={(e) => handleLevelBlur(c.id, e.target.value)}
                    style={{ width: "4rem" }}
                    title={
                      maxBaseLevel !== null && c.level === maxBaseLevel
                        ? "Baseカンスト"
                        : undefined
                    }
                  />
                  {maxBaseLevel !== null && c.level === maxBaseLevel && (
                    <span className="level-capped-mark" title="Baseカンスト">
                      {" "}
                      ★
                    </span>
                  )}
                </td>
                <td
                  className={
                    maxJobLevel !== null && c.jobLevel === maxJobLevel
                      ? "level-capped"
                      : ""
                  }
                >
                  <input
                    key={c.jobLevel}
                    type="number"
                    min="1"
                    defaultValue={c.jobLevel ?? ""}
                    onBlur={(e) => handleJobLevelBlur(c.id, e.target.value)}
                    style={{ width: "4rem" }}
                    title={
                      maxJobLevel !== null && c.jobLevel === maxJobLevel
                        ? "Jobカンスト"
                        : undefined
                    }
                  />
                  {maxJobLevel !== null && c.jobLevel === maxJobLevel && (
                    <span className="level-capped-mark" title="Jobカンスト">
                      {" "}
                      ★
                    </span>
                  )}
                </td>
                <td>{c.job || "—"}</td>
                <td>
                  <input
                    key={c.money}
                    defaultValue={(c.money ?? 0).toLocaleString()}
                    onBlur={(e) => handleMoneyBlur(c.id, e.target.value)}
                    style={{ width: "7rem" }}
                  />
                </td>
                <td>
                  <ReorderButtons
                    onMoveUp={() => moveUp(c.id)}
                    onMoveDown={() => moveDown(c.id)}
                    canMoveUp={sortKey === null && sorted[0]?.id !== c.id}
                    canMoveDown={
                      sortKey === null && sorted[sorted.length - 1]?.id !== c.id
                    }
                  />
                  <button
                    type="button"
                    onClick={() => archiveCharacter(c.id, !c.archived)}
                  >
                    {c.archived ? "復元" : "除外"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `キャラクター「${c.name}」を削除しますか？（取り消せません。周回記録などは残ります）`,
                        )
                      ) {
                        deleteCharacter(c.id);
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
                  {search
                    ? "一致するキャラクターがありません"
                    : "まだキャラクターがいません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
