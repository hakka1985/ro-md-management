import { useState, type FormEvent } from "react";
import { useItemPrices } from "./useFinance";
import { parseZeny, formatZ } from "../../lib/zeny";
import { Modal } from "../../components/Modal";
import { MasterExportImportPanel } from "../../components/MasterExportImportPanel";
import { useToast } from "../../components/toastContext";
import type { ItemPrice } from "../../db/types";

const STALE_PRICE_DAYS = 30;

function priceStaleDays(p: ItemPrice): number | null {
  if (p.expectedPrice <= 0) return null;
  if (!p.updatedAt) return Infinity;
  return (Date.now() - p.updatedAt) / (24 * 60 * 60 * 1000);
}

export function ItemMasterTable() {
  const {
    itemPrices,
    upsertItemPrice,
    updateItemPrice,
    archiveItemPrice,
    deleteItemPrice,
    restoreItemPrice,
    importItemPrices,
  } = useItemPrices();
  const { showUndo } = useToast();
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editing, setEditing] = useState<ItemPrice | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const filtered = (itemPrices ?? []).filter((p) =>
    p.itemName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await upsertItemPrice({
      itemName: name,
      expectedPrice: parseZeny(newPrice),
      url: newUrl.trim() || undefined,
    });
    setNewName("");
    setNewPrice("");
    setNewUrl("");
  }

  function openEdit(p: ItemPrice) {
    setEditing(p);
    setEditPrice(p.expectedPrice.toLocaleString());
    setEditUrl(p.url ?? "");
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await updateItemPrice(editing.id, {
      expectedPrice: parseZeny(editPrice),
      url: editUrl.trim() || undefined,
    });
    setEditing(null);
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>アイテムマスタ</h2>
        <p className="hint">
          ⏰要見直しは、価格を{STALE_PRICE_DAYS}
          日以上更新していないアイテムに表示されます。相場が変わっていないか確認してください。
        </p>

        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder="アイテム名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            placeholder="想定単価（例: 10k）"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <input
            placeholder="URL（任意）"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <button type="submit">登録</button>
        </form>

        <input
          placeholder="アイテム名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", margin: "0.75rem 0" }}
        />

        <div className="scrollable-table">
          <table className="md-master-table">
            <thead>
              <tr>
                <th>アイテム名</th>
                <th>想定単価</th>
                <th>URL</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const staleDays = priceStaleDays(p);
                const isStale = staleDays !== null && staleDays >= STALE_PRICE_DAYS;
                return (
                <tr key={p.id} className={p.archived ? "archived" : ""}>
                  <td style={{ textAlign: "left" }}>{p.itemName}</td>
                  <td title={`${p.expectedPrice.toLocaleString()} z`}>
                    {formatZ(p.expectedPrice)}
                    {isStale && (
                      <span
                        className="stale-price"
                        title={
                          staleDays === Infinity
                            ? "更新日時が記録される前に登録された価格です"
                            : `最終更新から約${Math.floor(staleDays)}日経過しています`
                        }
                      >
                        {" "}
                        ⏰要見直し
                      </span>
                    )}
                  </td>
                  <td>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        開く
                      </a>
                    ) : (
                      <span className="entity-list-sub">未設定</span>
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => openEdit(p)}>
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveItemPrice(p.id, !p.archived)}
                    >
                      {p.archived ? "復元" : "除外"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${p.itemName}」をアイテムマスタから削除しますか？（在庫・取引履歴からは削除されません。それらは想定単価0の未登録アイテム扱いになります）`,
                          )
                        ) {
                          const record = p;
                          deleteItemPrice(p.id);
                          showUndo(`「${p.itemName}」を削除しました`, () =>
                            restoreItemPrice(record),
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    {search
                      ? "一致するアイテムがありません"
                      : "まだアイテム単価が登録されていません"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal open={editing !== null} onClose={() => setEditing(null)}>
          {editing && (
            <form className="stacked-form" onSubmit={handleEditSave}>
              <h2>{editing.itemName} を編集</h2>
              <label>
                想定単価
                <input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </label>
              <label>
                URL（任意）
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
              </label>
              <div className="form-actions">
                <button type="submit">保存する</button>
                <button type="button" onClick={() => setEditing(null)}>
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </Modal>
      </section>

      <MasterExportImportPanel
        label="アイテムマスタ"
        tableName="itemPrices"
        data={itemPrices ?? []}
        onImport={importItemPrices}
      />
    </div>
  );
}
