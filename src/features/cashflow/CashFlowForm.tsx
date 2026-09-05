import { useState, type FormEvent } from "react";
import { useCashFlowPlan } from "./useCashFlowPlan";
import { useItemPrices, useInventory } from "../finance/useFinance";
import { parseZeny } from "../../lib/zeny";
import type { CashFlowPlanKind } from "../../db/types";

export function CashFlowForm() {
  const { addEntry } = useCashFlowPlan();
  const { itemPrices } = useItemPrices();
  const { inventory } = useInventory();
  const [kind, setKind] = useState<CashFlowPlanKind>("sell");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // "売る予定" can only realistically be filled from stock you actually
  // hold — sourcing it from the item-price master (like "買う予定" does)
  // kept surfacing items with zero inventory as candidates.
  const sellCandidates = (inventory ?? []).filter((i) => i.quantity > 0);
  const buyCandidates = itemPrices?.filter((p) => !p.archived) ?? [];
  const nameCandidates =
    kind === "sell"
      ? sellCandidates.map((i) => i.itemName)
      : buyCandidates.map((p) => p.itemName);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const qty = Number(quantity);
    const unitPrice = parseZeny(unitPriceInput);
    if (!itemName.trim() || Number.isNaN(qty) || qty <= 0) return;
    setSubmitting(true);
    try {
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
    } finally {
      setSubmitting(false);
    }
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
          {nameCandidates.map((name) => (
            <option key={name} value={name} />
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
        <button type="submit" disabled={submitting}>
          予定に追加する
        </button>
      </div>
    </form>
  );
}
