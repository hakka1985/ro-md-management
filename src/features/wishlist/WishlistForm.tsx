import { useState, type FormEvent } from "react";
import { useWishlist } from "./useWishlist";
import { parseZeny } from "../../lib/zeny";

export function WishlistForm() {
  const { addItem } = useWishlist();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [memo, setMemo] = useState("");
  const [eventTag, setEventTag] = useState("");
  const [refineTarget, setRefineTarget] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const cost = parseZeny(unitCost);
    if (!itemName.trim() || Number.isNaN(qty) || qty <= 0 || cost < 0) return;
    await addItem({
      itemName: itemName.trim(),
      quantity: qty,
      unitCost: cost,
      memo: memo.trim(),
      eventTag: eventTag.trim() || undefined,
      refineTarget: refineTarget.trim() || undefined,
    });
    setItemName("");
    setQuantity("1");
    setUnitCost("");
    setMemo("");
    // イベント名・目標精錬値はあえてクリアしない — 同じイベント向けに何十件も
    // 続けて登録するのが実際の使い方なので、毎回打ち直さずに済むようにする。
  }

  return (
    <form className="panel stacked-form" onSubmit={handleSubmit}>
      <h2>欲しいものを追加</h2>

      <label>
        アイテム名
        <input
          placeholder="例: 万能薬"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
      </label>

      <label>
        欲しい数
        <input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </label>

      <label>
        1個あたりの想定コスト
        <input
          placeholder="例: 500k, 1.5M, 1G"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          required
        />
      </label>

      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <label>
        イベント名（任意）
        <input
          placeholder="例: 2027精錬祭り"
          value={eventTag}
          onChange={(e) => setEventTag(e.target.value)}
        />
        <span className="hint">
          入力すると、下の「欲しいものリスト」ではなく「イベント仕入れ計画」に個数・精錬達成の進捗付きで表示されます。同じイベント名で複数登録すると1つのイベントとしてまとめられます。
        </span>
      </label>

      {eventTag.trim() && (
        <label>
          目標精錬値（任意）
          <input
            placeholder="例: +7"
            value={refineTarget}
            onChange={(e) => setRefineTarget(e.target.value)}
          />
        </label>
      )}

      <div className="form-actions">
        <button type="submit">追加する</button>
      </div>
    </form>
  );
}
