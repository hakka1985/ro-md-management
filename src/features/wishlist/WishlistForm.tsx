import { useState, type FormEvent } from "react";
import { useWishlist } from "./useWishlist";
import { parseZeny } from "../../lib/zeny";

export function WishlistForm() {
  const { addItem } = useWishlist();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [memo, setMemo] = useState("");

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
    });
    setItemName("");
    setQuantity("1");
    setUnitCost("");
    setMemo("");
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

      <div className="form-actions">
        <button type="submit">追加する</button>
      </div>
    </form>
  );
}
