import { useState } from "react";
import { useWishlist } from "./useWishlist";
import { WishlistEditForm } from "./WishlistList";
import { formatZ } from "../../lib/zeny";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { WishlistItem } from "../../db/types";

/** イベントタグ付きの欲しいものアイテムを、イベントごとに個数・精錬達成の進捗付きでまとめて表示するパネル。タグなしアイテムは通常のWishlistList側に残る。 */
export function EventPrepPanel() {
  const {
    items,
    updateItem,
    deleteItem,
    restoreItem,
    adjustObtainedQuantity,
    adjustAchievedQuantity,
  } = useWishlist();
  const { showUndo } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const eventItems = items.filter((i) => i.eventTag);
  const tags = [...new Set(eventItems.map((i) => i.eventTag as string))];
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const activeTag =
    selectedTag && tags.includes(selectedTag) ? selectedTag : tags[0];

  if (tags.length === 0) return null;

  const activeItems = eventItems.filter((i) => i.eventTag === activeTag);
  const editingItem = activeItems.find((i) => i.id === editingId) ?? null;

  const targetTotalQty = activeItems.reduce((s, i) => s + i.quantity, 0);
  const obtainedTotalQty = activeItems.reduce(
    (s, i) => s + (i.obtainedQuantity ?? 0),
    0,
  );
  const achievedTotalQty = activeItems.reduce(
    (s, i) => s + (i.achievedQuantity ?? 0),
    0,
  );
  const targetBudget = activeItems.reduce(
    (s, i) => s + i.quantity * i.unitCost,
    0,
  );
  const spentBudget = activeItems.reduce(
    (s, i) => s + Math.min(i.obtainedQuantity ?? 0, i.quantity) * i.unitCost,
    0,
  );
  const obtainedPct =
    targetTotalQty > 0
      ? Math.round((obtainedTotalQty / targetTotalQty) * 100)
      : 0;
  const achievedPct =
    obtainedTotalQty > 0
      ? Math.round((achievedTotalQty / obtainedTotalQty) * 100)
      : 0;

  // sellPriceが未入力のアイテムは利益計算に含めない（0円扱いにすると過小評価に
  // なるため、そもそも合計から除外する）。
  const itemsWithSellPrice = activeItems.filter(
    (i) => i.sellPrice !== undefined,
  );
  const hasSellPrice = itemsWithSellPrice.length > 0;
  const potentialProfit = itemsWithSellPrice.reduce(
    (s, i) => s + ((i.sellPrice as number) - i.unitCost) * i.quantity,
    0,
  );
  const achievedProfit = itemsWithSellPrice.reduce(
    (s, i) =>
      s + ((i.sellPrice as number) - i.unitCost) * (i.achievedQuantity ?? 0),
    0,
  );

  return (
    <section className="panel">
      <h2>🔥 イベント仕入れ計画</h2>
      {tags.length > 1 && (
        <div className="tab-nav">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={tag === activeTag ? "tab-active" : ""}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="summary-tile-row">
        <div className="summary-tile">
          <div className="label">目標個数合計</div>
          <div className="value">{targetTotalQty}個</div>
        </div>
        <div className="summary-tile">
          <div className="label">仕入れ済み</div>
          <div className={`value ${obtainedPct >= 100 ? "good" : "accent"}`}>
            {obtainedTotalQty}個（{obtainedPct}%）
          </div>
        </div>
        <div className="summary-tile">
          <div className="label">想定仕入れ予算</div>
          <div className="value" title={`${targetBudget.toLocaleString()} z`}>
            {formatZ(targetBudget)}
          </div>
        </div>
        <div className="summary-tile">
          <div className="label">投入済み予算</div>
          <div
            className="value accent"
            title={`${spentBudget.toLocaleString()} z`}
          >
            {formatZ(spentBudget)}
          </div>
        </div>
        <div className="summary-tile">
          <div className="label">精錬達成</div>
          <div
            className={`value ${achievedPct >= 100 && obtainedTotalQty > 0 ? "good" : "accent"}`}
          >
            {achievedTotalQty}個
            {obtainedTotalQty > 0 && `（仕入れ済みの${achievedPct}%）`}
          </div>
        </div>
        {hasSellPrice && (
          <>
            <div className="summary-tile">
              <div className="label">想定利益（目標達成時）</div>
              <div
                className={`value ${potentialProfit >= 0 ? "good" : "danger"}`}
                title={`${potentialProfit.toLocaleString()} z`}
              >
                {potentialProfit >= 0 ? "+" : ""}
                {formatZ(potentialProfit)}
              </div>
            </div>
            <div className="summary-tile">
              <div className="label">精錬達成分の利益見込み</div>
              <div
                className={`value ${achievedProfit >= 0 ? "good" : "danger"}`}
                title={`${achievedProfit.toLocaleString()} z`}
              >
                {achievedProfit >= 0 ? "+" : ""}
                {formatZ(achievedProfit)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <th>装備名</th>
              <th>仕入れ値上限</th>
              <th>想定売値 / 利益</th>
              <th>仕入れ進捗</th>
              <th>精錬達成</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item) => {
              const obtainedQty = item.obtainedQuantity ?? 0;
              const achievedQty = item.achievedQuantity ?? 0;
              const obtainPct =
                item.quantity > 0
                  ? Math.min(
                      100,
                      Math.round((obtainedQty / item.quantity) * 100),
                    )
                  : 0;
              const obtainDone = obtainedQty >= item.quantity;
              const achievePct =
                obtainedQty > 0
                  ? Math.min(100, Math.round((achievedQty / obtainedQty) * 100))
                  : 0;
              const achieveDone = obtainedQty > 0 && achievedQty >= obtainedQty;
              return (
                <tr key={item.id}>
                  <td style={{ textAlign: "left" }}>
                    {item.itemName}
                    {item.refineTarget && (
                      <span className="refine-badge">{item.refineTarget}</span>
                    )}
                    {item.memo && (
                      <span className="entity-list-sub"> {item.memo}</span>
                    )}
                  </td>
                  <td title={`${item.unitCost.toLocaleString()} z`}>
                    {formatZ(item.unitCost)}
                  </td>
                  <td>
                    {item.sellPrice === undefined ? (
                      "—"
                    ) : (
                      <>
                        <span title={`${item.sellPrice.toLocaleString()} z`}>
                          {formatZ(item.sellPrice)}
                        </span>
                        <span
                          className="hint"
                          style={{ margin: 0, display: "block" }}
                        >
                          {item.sellPrice - item.unitCost >= 0 ? "+" : ""}
                          {formatZ(item.sellPrice - item.unitCost)}/個
                        </span>
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: "9rem" }}>
                    <div className="progress-bar-track">
                      <div
                        className={
                          obtainDone
                            ? "progress-bar-fill progress-bar-fill-complete"
                            : "progress-bar-fill"
                        }
                        style={{ width: `${obtainPct}%` }}
                      />
                    </div>
                    <span className="hint" style={{ margin: 0 }}>
                      {obtainedQty} / {item.quantity}個
                    </span>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="stepper-minus"
                        onClick={() => adjustObtainedQuantity(item.id, -1)}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustObtainedQuantity(item.id, 1)}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustObtainedQuantity(item.id, 10)}
                      >
                        +10
                      </button>
                    </div>
                  </td>
                  <td style={{ minWidth: "9rem" }}>
                    <div className="progress-bar-track">
                      <div
                        className={
                          achieveDone
                            ? "progress-bar-fill progress-bar-fill-complete"
                            : "progress-bar-fill progress-bar-fill-refine"
                        }
                        style={{ width: `${achievePct}%` }}
                      />
                    </div>
                    <span className="hint" style={{ margin: 0 }}>
                      {achievedQty} / {obtainedQty}個
                    </span>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="stepper-minus"
                        onClick={() => adjustAchievedQuantity(item.id, -1)}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustAchievedQuantity(item.id, 1)}
                      >
                        +1
                      </button>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setEditingId(item.id)}>
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${item.itemName}」をイベント仕入れ計画から削除しますか？`,
                          )
                        ) {
                          const record: WishlistItem = item;
                          deleteItem(item.id);
                          showUndo(`「${item.itemName}」を削除しました`, () =>
                            restoreItem(record),
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
          </tbody>
        </table>
      </div>

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
