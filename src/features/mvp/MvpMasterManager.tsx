import { useState, type FormEvent } from "react";
import { useMvpMaster } from "./useMvp";
import { Modal } from "../../components/Modal";
import { MasterExportImportPanel } from "../../components/MasterExportImportPanel";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import type { MvpMaster } from "../../db/types";

interface DialogProps {
  editing: MvpMaster | null;
  onClose: () => void;
}

function MvpDialog({ editing, onClose }: DialogProps) {
  const { addMvp, updateMvp } = useMvpMaster();
  const [name, setName] = useState(editing?.name ?? "");
  const [cardName, setCardName] = useState(editing?.cardName ?? "");
  const [map, setMap] = useState(editing?.map ?? "");
  const [dropItems, setDropItems] = useState<string[]>(
    editing?.dropItems ?? [],
  );
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState("");

  function updateDropItem(i: number, value: string) {
    setDropItems(dropItems.map((d, idx) => (idx === i ? value : d)));
  }
  function removeDropItem(i: number) {
    setDropItems(dropItems.filter((_, idx) => idx !== i));
  }
  function handleBulkAdd(e: FormEvent) {
    e.preventDefault();
    const names = bulkText
      .split(/[\n,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setDropItems([...dropItems, ...names]);
    setBulkText("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const cleanedName = name.trim();
    if (!cleanedName) return;
    const cleanedDropItems = [
      ...new Set(dropItems.map((d) => d.trim()).filter(Boolean)),
    ];

    if (editing) {
      await updateMvp(editing.id, {
        name: cleanedName,
        cardName: cardName.trim() || undefined,
        map: map.trim() || undefined,
        dropItems: cleanedDropItems.length ? cleanedDropItems : undefined,
      });
      onClose();
    } else {
      const result = await addMvp({
        name: cleanedName,
        cardName: cardName.trim(),
        map: map.trim(),
        dropItems: cleanedDropItems,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    }
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>{editing ? "MVPを編集" : "MVPを登録"}</h2>
      {error && <p className="form-error">{error}</p>}

      <label>
        MVP名
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </label>
      <label>
        カード名（任意）
        <input value={cardName} onChange={(e) => setCardName(e.target.value)} />
      </label>
      <label>
        出現マップ（任意）
        <input value={map} onChange={(e) => setMap(e.target.value)} />
      </label>

      <div className="stacked-form" style={{ gap: "0.4rem" }}>
        <span>ドロップ品（カード以外、任意・複数可）</span>
        {dropItems.map((d, i) => (
          <div key={i} className="inline-form" style={{ gap: "0.4rem" }}>
            <input
              value={d}
              onChange={(e) => updateDropItem(i, e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => removeDropItem(i)}>
              削除
            </button>
          </div>
        ))}
        {dropItems.length === 0 && (
          <p className="empty">まだドロップ品が登録されていません</p>
        )}
      </div>

      <label>
        まとめて追加（改行またはカンマ区切りで複数入力可）
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"例:\nアイテムA\nアイテムB"}
          style={{ width: "100%", height: "4rem" }}
        />
      </label>
      <div className="form-actions">
        <button type="button" onClick={handleBulkAdd}>
          ドロップ品を追加する
        </button>
      </div>

      <div className="form-actions">
        <button type="submit">{editing ? "保存する" : "登録する"}</button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

function sortValue(m: MvpMaster, key: string): string | number {
  switch (key) {
    case "name":
      return m.name;
    case "cardName":
      return m.cardName ?? "";
    case "map":
      return m.map ?? "";
    default:
      return "";
  }
}

export function MvpMasterManager() {
  const { mvpMaster, archiveMvp, importMvpMaster } = useMvpMaster();
  const [dialogState, setDialogState] = useState<
    { open: false } | { open: true; editing: MvpMaster | null }
  >({ open: false });
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = (mvpMaster ?? []).filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.cardName ?? "").toLowerCase().includes(q) ||
      (m.map ?? "").toLowerCase().includes(q) ||
      (m.dropItems ?? []).some((d) => d.toLowerCase().includes(q)),
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    sortValue,
  );

  return (
    <div className="page">
      <section className="panel">
        <h2>MVPマスタ管理</h2>
        <div className="form-actions">
          <button
            type="button"
            onClick={() => setDialogState({ open: true, editing: null })}
          >
            + MVPを登録する
          </button>
        </div>
        <input
          placeholder="MVP名・カード名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", margin: "0.5rem 0" }}
        />
        <div className="scrollable-table">
          <table className="md-master-table">
            <thead>
              <tr>
                <SortableHeader
                  label="MVP名"
                  sortKey="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="カード名"
                  sortKey="cardName"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th>ドロップ品</th>
                <SortableHeader
                  label="出現マップ"
                  sortKey="map"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className={m.archived ? "archived" : ""}>
                  <td style={{ textAlign: "left" }}>{m.name}</td>
                  <td>{m.cardName || "—"}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                    {m.dropItems?.length ? m.dropItems.join("、") : "—"}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>{m.map || "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setDialogState({ open: true, editing: m })}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveMvp(m.id, !m.archived)}
                    >
                      {m.archived ? "復元" : "除外"}
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    {search
                      ? "一致するMVPがありません"
                      : "まだMVPが登録されていません"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal
          open={dialogState.open}
          onClose={() => setDialogState({ open: false })}
        >
          {dialogState.open && (
            <MvpDialog
              editing={dialogState.editing}
              onClose={() => setDialogState({ open: false })}
            />
          )}
        </Modal>
      </section>

      <MasterExportImportPanel
        label="MVPマスタ"
        tableName="mvpMaster"
        data={mvpMaster ?? []}
        onImport={importMvpMaster}
      />
    </div>
  );
}
