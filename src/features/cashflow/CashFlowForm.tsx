import { useState, type FormEvent } from "react";
import { useCashFlowPlan } from "./useCashFlowPlan";
import { useItemPrices } from "../finance/useFinance";
import { parseZeny } from "../../lib/zeny";
import type { CashFlowPlanKind } from "../../db/types";

export function CashFlowForm() {
  const { addEntry } = useCashFlowPlan();
  const { itemPrices } = useItemPrices();
  const [kind, setKind] = useState<CashFlowPlanKind>("sell");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [memo, setMemo] = useState("");

  const activeItems = itemPrices?.filter((p) => !p.archived) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const unitPrice = parseZeny(unitPriceInput);
    if (!itemName.trim() || Number.isNaN(qty) || qty <= 0) return;
    await addEntry({
      kind,
      itemName: itemName.trim(),
      quantity: qty,
      unitPrice,
      memo: memo.trim(),
    });
    setItemName("");
    setQuantity("1");
    setUnitPriceInput("");
    setMemo("");
  }

  return (
    <form className="panel stacked-form" onSubmit={handleSubmit}>
      <h2>予定を追加</h2>

      <label className="checkbox-label">
        <input
          type="radio"
          checked={kind === "sell"}
          onChange={() => setKind("sell")}
        />
        売る予定（資金プラス）
      </label>
      <label className="checkbox-label">
        <input
          type="radio"
          checked={kind === "buy"}
          onChange={() => setKind("buy")}
        />
        買う予定（資金マイナス）
      </label>

      <label>
        アイテム名
        <input
          list="cash-flow-item-options"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
        <datalist id="cash-flow-item-options">
          {activeItems.map((p) => (
            <option key={p.id} value={p.itemName} />
          ))}
        </datalist>
      </label>

      <label>
        個数
        <input
          type="number"
          min="0.01"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </label>

      <label>
        想定単価（1個あたり、例: 10k, 1.5M）
        <input
          placeholder="例: 10k"
          value={unitPriceInput}
          onChange={(e) => setUnitPriceInput(e.target.value)}
        />
      </label>

      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit">予定に追加する</button>
      </div>
    </form>
  );
}
