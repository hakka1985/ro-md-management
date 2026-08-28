import { useState, type DragEvent, type FormEvent } from "react";
import { useMdDungeons } from "./useMd";
import { useMdMasterConfig } from "./useMdMasterConfig";
import { Modal } from "../../components/Modal";
import { MasterExportImportPanel } from "../../components/MasterExportImportPanel";
import { ReorderButtons } from "../../components/ReorderButtons";
import type { MdCtType, MdDungeon, MdDungeonMode } from "../../db/types";

const CT_OPTIONS: { value: MdCtType; label: string }[] = [
  { value: "daily", label: "翌日" },
  { value: "3days", label: "3日" },
  { value: "weeklyTue12", label: "週間" },
];

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

interface HeaderCellProps {
  dungeon: MdDungeon;
  onUpdate: (id: string, patch: Partial<Omit<MdDungeon, "id">>) => void;
  onArchive: (id: string, archived: boolean) => void;
  onOpenMobDialog: (dungeonId: string) => void;
  onOpenModeDialog: (dungeonId: string) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  showArchiveButton?: boolean;
}

function MdHeaderCell({
  dungeon,
  onUpdate,
  onArchive,
  onOpenMobDialog,
  onOpenModeDialog,
  onTogglePinned,
  showArchiveButton = true,
}: HeaderCellProps) {
  return (
    <div
      className={
        dungeon.archived
          ? "archived md-master-header-cell"
          : "md-master-header-cell"
      }
    >
      <div className="md-master-header-row">
        <button
          type="button"
          className={dungeon.pinned ? "pin-button pinned" : "pin-button"}
          onClick={() => onTogglePinned(dungeon.id, !dungeon.pinned)}
          title={dungeon.pinned ? "ピン留めを解除" : "ピン留めして上位固定表示"}
          draggable={false}
        >
          {dungeon.pinned ? "★" : "☆"}
        </button>
        <input
          defaultValue={dungeon.name}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== dungeon.name)
              onUpdate(dungeon.id, { name: value });
          }}
          style={{ fontWeight: "bold", flex: "1 1 8rem", minWidth: "6rem" }}
        />
        <input
          key={dungeon.requiredLevel}
          type="number"
          min="1"
          placeholder="Lv制限なし"
          title="必要Lv（任意）。達していないキャラは自動で対象外になります"
          draggable={false}
          defaultValue={dungeon.requiredLevel ?? ""}
          onBlur={(e) => {
            const value = e.target.value.trim();
            const n = Number(value);
            onUpdate(dungeon.id, {
              requiredLevel: value && !Number.isNaN(n) && n > 0 ? n : undefined,
            });
          }}
          style={{ width: "6rem" }}
        />
      </div>
      <div className="md-master-header-row">
        <select
          value={dungeon.ctType}
          onChange={(e) =>
            onUpdate(dungeon.id, { ctType: e.target.value as MdCtType })
          }
          style={{ flex: "0 0 auto" }}
        >
          {CT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="md-master-mvp-count">
          MVP: {dungeon.mvpMobs.length}
        </span>
        <button type="button" onClick={() => onOpenMobDialog(dungeon.id)}>
          MOB追加
        </button>
        {dungeon.modes && dungeon.modes.length > 0 && (
          <span
            className="md-master-mvp-count"
            title="討伐/生存モードのように、選ぶモードによって出現するMVPが変わる設定です"
            draggable={false}
          >
            モード: {dungeon.modes.length}
          </span>
        )}
        <button type="button" onClick={() => onOpenModeDialog(dungeon.id)}>
          モード管理
        </button>
        <input
          key={dungeon.accountCharacterLimit}
          type="number"
          min="1"
          placeholder="上限なし"
          title="アカウントあたりの挑戦可能キャラ数上限（任意）"
          draggable={false}
          defaultValue={dungeon.accountCharacterLimit ?? ""}
          onBlur={(e) => {
            const value = e.target.value.trim();
            const n = Number(value);
            onUpdate(dungeon.id, {
              accountCharacterLimit:
                value && !Number.isNaN(n) && n > 0 ? n : undefined,
            });
          }}
          style={{ width: "5rem" }}
        />
        <input
          key={dungeon.attemptsPerCycle}
          type="number"
          min="1"
          placeholder="挑戦1回"
          title="1キャラが1サイクルに挑戦できる回数（任意、未設定は1回）。2回以上に設定すると、その回数を使い切るまでCTが明けたまま記録できます"
          draggable={false}
          defaultValue={dungeon.attemptsPerCycle ?? ""}
          onBlur={(e) => {
            const value = e.target.value.trim();
            const n = Number(value);
            onUpdate(dungeon.id, {
              attemptsPerCycle:
                value && !Number.isNaN(n) && n > 0 ? n : undefined,
            });
          }}
          style={{ width: "5rem" }}
        />
        <label
          className="checkbox-label"
          title="このMDに得点の実績がある場合にチェック。記録時に得点の入力欄が出て、最高記録の判定で最優先されます"
        >
          <input
            type="checkbox"
            checked={dungeon.tracksScore ?? false}
            onChange={(e) =>
              onUpdate(dungeon.id, { tracksScore: e.target.checked })
            }
          />
          得点あり
        </label>
        {dungeon.tracksScore && (
          <input
            key={dungeon.defaultScore}
            type="number"
            placeholder="初期値なし"
            title="記録フォームを開いたときに得点欄へ最初から入る値（任意）。固定得点のMD向け"
            draggable={false}
            defaultValue={dungeon.defaultScore ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              const n = Number(value);
              onUpdate(dungeon.id, {
                defaultScore: value && !Number.isNaN(n) ? n : undefined,
              });
            }}
            style={{ width: "5.5rem" }}
          />
        )}
        <label
          className="checkbox-label"
          title="このMDに踏破部屋数の実績がある場合にチェック。記録時に部屋数の入力欄が出て、得点に次ぐ優先度で最高記録の判定に使われます"
        >
          <input
            type="checkbox"
            checked={dungeon.tracksRooms ?? false}
            onChange={(e) =>
              onUpdate(dungeon.id, { tracksRooms: e.target.checked })
            }
          />
          部屋数あり
        </label>
        {dungeon.tracksRooms && (
          <input
            key={dungeon.defaultRooms}
            type="number"
            min="0"
            placeholder="初期値なし"
            title="記録フォームを開いたときに部屋数欄へ最初から入る値（任意）。固定部屋数のMD向け"
            draggable={false}
            defaultValue={dungeon.defaultRooms ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              const n = Number(value);
              onUpdate(dungeon.id, {
                defaultRooms:
                  value && !Number.isNaN(n) && n >= 0 ? n : undefined,
              });
            }}
            style={{ width: "5.5rem" }}
          />
        )}
        {showArchiveButton && (
          <button
            type="button"
            onClick={() => onArchive(dungeon.id, !dungeon.archived)}
          >
            {dungeon.archived ? "復元" : "除外"}
          </button>
        )}
      </div>
    </div>
  );
}

interface MobListEditorProps {
  rows: string[];
  onChange: (rows: string[]) => void;
}

/** Editable name-list UI (row edit/delete/add + bulk paste) shared by the flat MOB list dialog and each mode's own MOB list — pure controlled component, commit happens in the caller's own "保存" button. */
function MobListEditor({ rows, onChange }: MobListEditorProps) {
  const [bulkText, setBulkText] = useState("");

  function updateRow(i: number, value: string) {
    onChange(rows.map((r, idx) => (idx === i ? value : r)));
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  function addEmptyRow() {
    onChange([...rows, ""]);
  }

  function handleBulkAdd(e: FormEvent) {
    e.preventDefault();
    const names = bulkText
      .split(/[\n,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    onChange([...rows, ...names]);
    setBulkText("");
  }

  return (
    <div className="stacked-form" style={{ gap: "0.4rem" }}>
      <div className="stacked-form" style={{ gap: "0.4rem" }}>
        {rows.map((name, i) => (
          <div key={i} className="inline-form" style={{ gap: "0.4rem" }}>
            <input
              value={name}
              onChange={(e) => updateRow(i, e.target.value)}
              style={{ flex: 1 }}
              autoFocus={i === rows.length - 1 && name === ""}
            />
            <button type="button" onClick={() => removeRow(i)}>
              削除
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="empty">まだMOBが登録されていません</p>
        )}
        <button type="button" onClick={addEmptyRow}>
          + 行を追加
        </button>
      </div>

      <form onSubmit={handleBulkAdd} className="stacked-form">
        <label>
          まとめて追加（改行またはカンマ区切りで複数入力可）
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"例:\nMobA\nMobB\nMobC"}
            style={{ width: "100%", height: "4rem" }}
          />
        </label>
        <div className="form-actions">
          <button type="submit">まとめて追加する</button>
        </div>
      </form>
    </div>
  );
}

interface MobDialogProps {
  dungeon: MdDungeon;
  onUpdate: (id: string, patch: Partial<Omit<MdDungeon, "id">>) => void;
  onClose: () => void;
}

function MdMobDialog({ dungeon, onUpdate, onClose }: MobDialogProps) {
  const [rows, setRows] = useState<string[]>(dungeon.mvpMobs);

  function handleSave() {
    const cleaned = [...new Set(rows.map((r) => r.trim()).filter(Boolean))];
    onUpdate(dungeon.id, { mvpMobs: cleaned });
    onClose();
  }

  return (
    <div className="stacked-form">
      <h2>{dungeon.name} のMVP MOB管理</h2>

      <MobListEditor rows={rows} onChange={setRows} />

      <div className="form-actions">
        <button type="button" onClick={handleSave}>
          保存
        </button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

interface ModeDialogProps {
  dungeon: MdDungeon;
  onUpdate: (id: string, patch: Partial<Omit<MdDungeon, "id">>) => void;
  onClose: () => void;
}

function MdModeDialog({ dungeon, onUpdate, onClose }: ModeDialogProps) {
  const [modes, setModes] = useState<MdDungeonMode[]>(dungeon.modes ?? []);
  const [newModeName, setNewModeName] = useState("");

  function renameMode(i: number, name: string) {
    setModes(modes.map((m, idx) => (idx === i ? { ...m, name } : m)));
  }

  function removeMode(i: number) {
    setModes(modes.filter((_, idx) => idx !== i));
  }

  function updateModeMobs(i: number, mvpMobs: string[]) {
    setModes(modes.map((m, idx) => (idx === i ? { ...m, mvpMobs } : m)));
  }

  function addMode(e: FormEvent) {
    e.preventDefault();
    if (!newModeName.trim()) return;
    setModes([...modes, { name: newModeName.trim(), mvpMobs: [] }]);
    setNewModeName("");
  }

  function handleSave() {
    const cleaned = modes
      .map((m) => ({
        name: m.name.trim(),
        mvpMobs: [...new Set(m.mvpMobs.map((x) => x.trim()).filter(Boolean))],
      }))
      .filter((m) => m.name);
    onUpdate(dungeon.id, {
      modes: cleaned.length > 0 ? cleaned : undefined,
    });
    onClose();
  }

  return (
    <div className="stacked-form">
      <h2>{dungeon.name} のモード管理</h2>
      <p className="hint">
        討伐/生存モードのように、同じMDでも選ぶモードによって出現するMVPが変わる場合に
        使います。周回を記録するときにここで登録したモードから選ぶと、そのモードの
        MVPだけが討伐チェック対象になります。モードを1つも登録しなければ、これまで
        どおり「MOB追加」で設定したMVP一覧がそのまま使われます。
      </p>

      {modes.map((mode, i) => (
        <div key={i} className="panel" style={{ padding: "0.6rem" }}>
          <div className="inline-form" style={{ gap: "0.4rem" }}>
            <input
              value={mode.name}
              onChange={(e) => renameMode(i, e.target.value)}
              placeholder="モード名（例: 討伐モード）"
              style={{ flex: 1, fontWeight: "bold" }}
            />
            <button type="button" onClick={() => removeMode(i)}>
              モード削除
            </button>
          </div>
          <MobListEditor
            rows={mode.mvpMobs}
            onChange={(mvpMobs) => updateModeMobs(i, mvpMobs)}
          />
        </div>
      ))}
      {modes.length === 0 && (
        <p className="empty">まだモードが登録されていません</p>
      )}

      <form onSubmit={addMode} className="inline-form">
        <input
          value={newModeName}
          onChange={(e) => setNewModeName(e.target.value)}
          placeholder="新しいモード名"
          style={{ flex: 1 }}
        />
        <button type="submit">+ モードを追加</button>
      </form>

      <div className="form-actions">
        <button type="button" onClick={handleSave}>
          保存
        </button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

interface ItemCellProps {
  dungeon: MdDungeon;
  itemName: string;
  onToggle: () => void;
  onQtyChange: (qty: number) => void;
}

function MdItemCell({
  dungeon,
  itemName,
  onToggle,
  onQtyChange,
}: ItemCellProps) {
  const isSet = itemName in dungeon.items;
  const qty = dungeon.items[itemName] ?? 0;
  return (
    <td>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.2rem",
        }}
      >
        <span
          onClick={onToggle}
          style={{
            cursor: "pointer",
            fontSize: "1.2rem",
            color: isSet ? "var(--text)" : "var(--border)",
          }}
        >
          {isSet ? "★" : "☆"}
        </span>
        {isSet && (
          <input
            type="number"
            min="0"
            step="1"
            value={qty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onQtyChange(Number(e.target.value))}
            style={{ width: "3.5rem" }}
          />
        )}
      </div>
    </td>
  );
}

export function MdMasterTable() {
  const {
    dungeons,
    addDungeon,
    updateDungeon,
    archiveDungeon,
    reorderDungeon,
    togglePinned,
    importDungeons,
  } = useMdDungeons();
  const activeDungeons = dungeons ?? [];
  const {
    itemOrder,
    transpose,
    addItemToMaster,
    removeItemFromMaster,
    reorderItem,
    toggleTranspose,
  } = useMdMasterConfig(activeDungeons);

  const [newDungeonName, setNewDungeonName] = useState("");
  const [newDungeonCt, setNewDungeonCt] = useState<MdCtType>("daily");
  const [newDungeonMobs, setNewDungeonMobs] = useState("");
  const [newDungeonAccountLimit, setNewDungeonAccountLimit] = useState("");
  const [newDungeonRequiredLevel, setNewDungeonRequiredLevel] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [mobDialogId, setMobDialogId] = useState<string | null>(null);
  const [modeDialogId, setModeDialogId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchQuery = search.trim().toLowerCase();
  const searchedDungeons = searchQuery
    ? activeDungeons.filter((d) => d.name.toLowerCase().includes(searchQuery))
    : activeDungeons;
  const searchedItems = searchQuery
    ? itemOrder.filter((item) => item.toLowerCase().includes(searchQuery))
    : itemOrder;
  const mobDialogDungeon =
    activeDungeons.find((d) => d.id === mobDialogId) ?? null;
  const modeDialogDungeon =
    activeDungeons.find((d) => d.id === modeDialogId) ?? null;

  async function handleAddDungeon(e: FormEvent) {
    e.preventDefault();
    if (!newDungeonName.trim()) return;
    const mvpMobs = [
      ...new Set(
        newDungeonMobs
          .split(/[\n,、]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    const limit = Number(newDungeonAccountLimit);
    const requiredLevel = Number(newDungeonRequiredLevel);
    await addDungeon({
      name: newDungeonName.trim(),
      ctType: newDungeonCt,
      mvpMobs,
      accountCharacterLimit:
        newDungeonAccountLimit.trim() && !Number.isNaN(limit) && limit > 0
          ? limit
          : undefined,
      requiredLevel:
        newDungeonRequiredLevel.trim() &&
        !Number.isNaN(requiredLevel) &&
        requiredLevel > 0
          ? requiredLevel
          : undefined,
    });
    setNewDungeonName("");
    setNewDungeonCt("daily");
    setNewDungeonMobs("");
    setNewDungeonAccountLimit("");
    setNewDungeonRequiredLevel("");
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    await addItemToMaster(newItemName.trim());
    setNewItemName("");
  }

  function toggleItem(dungeon: MdDungeon, item: string) {
    const next = { ...dungeon.items };
    if (item in next) delete next[item];
    else next[item] = 0;
    updateDungeon(dungeon.id, { items: next });
  }

  function setItemQty(dungeon: MdDungeon, item: string, qty: number) {
    if (Number.isNaN(qty) || qty < 0) return;
    updateDungeon(dungeon.id, { items: { ...dungeon.items, [item]: qty } });
  }

  function confirmRemoveItem(item: string) {
    if (
      window.confirm(
        `アイテム「${item}」をマスタから削除しますか？（全MDから外れます）`,
      )
    ) {
      removeItemFromMaster(item);
    }
  }

  function onDragStartMd(e: DragEvent, id: string) {
    e.dataTransfer.setData("mdId", id);
  }
  function onDropMd(e: DragEvent, dropId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("mdId");
    if (id) reorderDungeon(id, dropId);
  }
  function moveDungeonUp(id: string) {
    const idx = searchedDungeons.findIndex((d) => d.id === id);
    if (idx <= 0) return;
    reorderDungeon(id, searchedDungeons[idx - 1].id);
  }
  function moveDungeonDown(id: string) {
    const idx = searchedDungeons.findIndex((d) => d.id === id);
    if (idx === -1 || idx >= searchedDungeons.length - 1) return;
    reorderDungeon(id, searchedDungeons[idx + 1].id);
  }
  function onDragStartItem(e: DragEvent, name: string) {
    e.dataTransfer.setData("itemName", name);
  }
  function onDropItem(e: DragEvent, dropName: string) {
    e.preventDefault();
    const name = e.dataTransfer.getData("itemName");
    if (name) reorderItem(name, dropName);
  }

  return (
    <div className="page md-master-page">
      <section className="panel md-master-panel">
        <h2>MDマスタ表</h2>
        <p className="hint">
          MD名・CTを行/列見出しで直接編集、★クリックでアイテム設定、行や列見出しはドラッグで並び替えできます。
          必要Lvを設定すると、達していないキャラはMD進捗グリッドで自動的に「対象外」になります。
        </p>
        {activeDungeons.length > 0 && (
          <input
            placeholder={transpose ? "アイテム名で検索" : "MD名で検索"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", margin: "0.5rem 0" }}
          />
        )}
        {activeDungeons.length === 0 ? (
          <p className="empty">
            まだMDが登録されていません。下のフォームから追加してください。
          </p>
        ) : (
          <div className="md-master-scroll">
            <table className="md-master-table">
              {!transpose ? (
                <>
                  <thead>
                    <tr>
                      <th className="md-master-sticky-col">MD設定</th>
                      {itemOrder.map((item) => (
                        <th
                          key={item}
                          draggable
                          onDragStart={(e) => onDragStartItem(e, item)}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropItem(e, item)}
                        >
                          <div>{item}</div>
                          <button
                            type="button"
                            onClick={() => confirmRemoveItem(item)}
                          >
                            ×
                          </button>
                        </th>
                      ))}
                      <th>除外</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedDungeons.map((d) => (
                      <tr
                        key={d.id}
                        draggable
                        onDragStart={(e) => onDragStartMd(e, d.id)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDropMd(e, d.id)}
                      >
                        <td className="md-master-sticky-col">
                          <MdHeaderCell
                            dungeon={d}
                            onUpdate={updateDungeon}
                            onArchive={archiveDungeon}
                            onOpenMobDialog={setMobDialogId}
                            onOpenModeDialog={setModeDialogId}
                            onTogglePinned={togglePinned}
                            showArchiveButton={false}
                          />
                        </td>
                        {itemOrder.map((item) => (
                          <MdItemCell
                            key={item}
                            dungeon={d}
                            itemName={item}
                            onToggle={() => toggleItem(d, item)}
                            onQtyChange={(q) => setItemQty(d, item, q)}
                          />
                        ))}
                        <td>
                          <ReorderButtons
                            onMoveUp={() => moveDungeonUp(d.id)}
                            onMoveDown={() => moveDungeonDown(d.id)}
                            canMoveUp={searchedDungeons[0]?.id !== d.id}
                            canMoveDown={
                              searchedDungeons[searchedDungeons.length - 1]
                                ?.id !== d.id
                            }
                          />
                          <button
                            type="button"
                            onClick={() => archiveDungeon(d.id, !d.archived)}
                          >
                            {d.archived ? "復元" : "除外"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th className="md-master-sticky-col">アイテム＼MD</th>
                      {activeDungeons.map((d) => (
                        <th
                          key={d.id}
                          draggable
                          onDragStart={(e) => onDragStartMd(e, d.id)}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropMd(e, d.id)}
                        >
                          <MdHeaderCell
                            dungeon={d}
                            onUpdate={updateDungeon}
                            onArchive={archiveDungeon}
                            onOpenMobDialog={setMobDialogId}
                            onOpenModeDialog={setModeDialogId}
                            onTogglePinned={togglePinned}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchedItems.map((item) => (
                      <tr
                        key={item}
                        draggable
                        onDragStart={(e) => onDragStartItem(e, item)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDropItem(e, item)}
                      >
                        <td className="md-master-sticky-col">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <b>{item}</b>
                            <button
                              type="button"
                              onClick={() => confirmRemoveItem(item)}
                            >
                              削除
                            </button>
                          </div>
                        </td>
                        {activeDungeons.map((d) => (
                          <MdItemCell
                            key={d.id}
                            dungeon={d}
                            itemName={item}
                            onToggle={() => toggleItem(d, item)}
                            onQtyChange={(q) => setItemQty(d, item, q)}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}

        <div className="stacked-form" style={{ marginTop: "1rem" }}>
          <form className="inline-form" onSubmit={handleAddDungeon}>
            <input
              placeholder="MD名"
              value={newDungeonName}
              onChange={(e) => setNewDungeonName(e.target.value)}
              required
            />
            <select
              value={newDungeonCt}
              onChange={(e) => setNewDungeonCt(e.target.value as MdCtType)}
            >
              {CT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="アカウント上限人数（任意）"
              value={newDungeonAccountLimit}
              onChange={(e) => setNewDungeonAccountLimit(e.target.value)}
              style={{ width: "11rem" }}
            />
            <input
              type="number"
              min="1"
              placeholder="必要Lv（任意）"
              value={newDungeonRequiredLevel}
              onChange={(e) => setNewDungeonRequiredLevel(e.target.value)}
              style={{ width: "9rem" }}
            />
            <textarea
              placeholder={"MVP MOB名（任意、改行/カンマ区切りで複数可）"}
              value={newDungeonMobs}
              onChange={(e) => setNewDungeonMobs(e.target.value)}
              style={{ width: "16rem", height: "2.2rem" }}
            />
            <button type="submit">MD追加</button>
          </form>
          <form className="inline-form" onSubmit={handleAddItem}>
            <input
              placeholder="アイテム名"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              required
            />
            <button type="submit">アイテムをマスタへ追加</button>
          </form>
          <button type="button" onClick={toggleTranspose}>
            🔄 縦横切替
          </button>
        </div>
      </section>

      <MasterExportImportPanel
        label="MDマスタ"
        tableName="mdDungeons"
        data={activeDungeons}
        onImport={importDungeons}
      />

      <Modal
        open={mobDialogDungeon !== null}
        onClose={() => setMobDialogId(null)}
      >
        {mobDialogDungeon && (
          <MdMobDialog
            dungeon={mobDialogDungeon}
            onUpdate={updateDungeon}
            onClose={() => setMobDialogId(null)}
          />
        )}
      </Modal>

      <Modal
        open={modeDialogDungeon !== null}
        onClose={() => setModeDialogId(null)}
      >
        {modeDialogDungeon && (
          <MdModeDialog
            dungeon={modeDialogDungeon}
            onUpdate={updateDungeon}
            onClose={() => setModeDialogId(null)}
          />
        )}
      </Modal>
    </div>
  );
}
