import { useState, type FormEvent } from "react";
import { useItemPrices, useInventory, useTransactions } from "./useFinance";
import { parseZeny, formatZ } from "../../lib/zeny";
import { partyShare } from "../../lib/party";
import { UnregisteredItemPrompt } from "./UnregisteredItemPrompt";
import type { FinanceType } from "../../db/types";

type TradeKind = "sell" | "buy" | "obtain" | "consume";

export function TradeForm() {
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { inventory, addStock, removeStock } = useInventory();
  const { addTransaction } = useTransactions();

  const [kind, setKind] = useState<TradeKind>("sell");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [isEventIncome, setIsEventIncome] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [unregisteredNames, setUnregisteredNames] = useState<string[]>([]);

  const activeItems = itemPrices?.filter((p) => !p.archived) ?? [];
  const inStock = inventory?.filter((i) => i.quantity > 0) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const name = itemName.trim();
    const qty = Number(quantity);
    const unitPrice = parseZeny(unitPriceInput);
    const party = Math.max(1, Number(partySize) || 1);

    if (!name || Number.isNaN(qty) || qty <= 0) {
      setError("アイテム名と個数を正しく入力してください。");
      return;
    }

    const tags = tagsInput
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (kind === "sell") {
      // Stock isn't required — this also covers equipment/items the user
      // already owned before tracking inventory here. If there's matching
      // stock it's decremented (clamped at 0); if not, the sale is still
      // recorded as income with nothing to subtract.
      const stock = inStock.find((i) => i.itemName === name);
      const recordedUnitPrice = Math.floor(unitPrice / party);
      const amount = qty * recordedUnitPrice;
      if (stock) await removeStock(name, qty);
      if (!activeItems.some((p) => p.itemName === name)) {
        await upsertItemPrice({ itemName: name, expectedPrice: 0 });
        setUnregisteredNames((prev) => [...prev, name]);
      }
      await addTransaction({
        type: "income" as FinanceType,
        itemName: name,
        quantity: qty,
        unitPrice: recordedUnitPrice,
        amount,
        date: Date.now(),
        source: "market",
        partySize: party,
        isEventIncome,
        tags,
      });
      setMessage(
        party > 1
          ? `売却を記録しました（PT${party}人で分配、記録額 ${formatZ(amount)}）。`
          : `売却を記録しました（${formatZ(amount)}）。`,
      );
    } else if (kind === "buy") {
      const amount = qty * unitPrice;
      if (!activeItems.some((p) => p.itemName === name)) {
        await upsertItemPrice({ itemName: name, expectedPrice: 0 });
        setUnregisteredNames((prev) => [...prev, name]);
      }
      await addStock(name, qty);
      await addTransaction({
        type: "expense" as FinanceType,
        itemName: name,
        quantity: qty,
        unitPrice,
        amount,
        date: Date.now(),
        source: "market",
        tags,
      });
      setMessage(`購入を記録しました（${formatZ(amount)}、在庫に追加）。`);
    } else if (kind === "obtain") {
      // obtain: free items (event drops, giveaways, etc.) — stock only, no
      // transaction. PT挑戦の場合は入手数もPT人数で分配する（partyShareは
      // MdDropPanelのドロップ分配と同じロジックで、割り切れない分は端数の
      // まま在庫に反映される）。
      const myShare = party > 1 ? partyShare(qty, party) : qty;
      if (!activeItems.some((p) => p.itemName === name)) {
        await upsertItemPrice({ itemName: name, expectedPrice: 0 });
        setUnregisteredNames((prev) => [...prev, name]);
      }
      await addStock(name, myShare);
      setMessage(
        party > 1
          ? `入手を記録しました（PT${party}人で分配、自分の取り分 ${myShare}個を在庫に追加、取引記録には計上されません）。`
          : `入手を記録しました（${qty}個を在庫に追加、取引記録には計上されません）。`,
      );
    } else {
      // consume: used the item yourself (potion, enchant material, food buff,
      // etc.) — stock only decreases, no transaction, since this isn't a
      // sale or a loss of money, just spending an asset you already had.
      await removeStock(name, qty);
      setMessage(
        `消費を記録しました（在庫から${qty}個減らしました、取引記録には計上されません）。`,
      );
    }

    setItemName("");
    setQuantity("1");
    setUnitPriceInput("");
    setPartySize("1");
    setIsEventIncome(false);
    setTagsInput("");
  }

  return (
    <>
      <form className="panel stacked-form" onSubmit={handleSubmit}>
        <h2>取引記録</h2>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-message">{message}</p>}

        <label className="checkbox-label">
          <input
            type="radio"
            checked={kind === "sell"}
            onChange={() => setKind("sell")}
          />
          販売 (+)
        </label>
        <label className="checkbox-label">
          <input
            type="radio"
            checked={kind === "buy"}
            onChange={() => setKind("buy")}
          />
          購入 (-)
        </label>
        <label className="checkbox-label">
          <input
            type="radio"
            checked={kind === "obtain"}
            onChange={() => setKind("obtain")}
          />
          入手（イベント等、在庫のみ増加）
        </label>
        <label className="checkbox-label">
          <input
            type="radio"
            checked={kind === "consume"}
            onChange={() => setKind("consume")}
          />
          消費（自己使用、在庫のみ減少）
        </label>

        <label>
          アイテム名
          <input
            list={
              kind === "sell" || kind === "consume"
                ? "trade-sell-options"
                : "trade-item-options"
            }
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
          <datalist id="trade-item-options">
            {activeItems.map((p) => (
              <option key={p.id} value={p.itemName} />
            ))}
          </datalist>
          <datalist id="trade-sell-options">
            {inStock.map((i) => (
              <option key={i.id} value={i.itemName}>
                在庫 {i.quantity}
              </option>
            ))}
          </datalist>
        </label>

        <label>
          個数
          <input
            type="number"
            min="0.01"
            step="any"
            title="PT分配で端数（例: 0.25個）になることがあります"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>

        {kind !== "obtain" && kind !== "consume" && (
          <label>
            単価（1個あたり、例: 10k, 1.5M）
            <input
              placeholder="例: 10k"
              value={unitPriceInput}
              onChange={(e) => setUnitPriceInput(e.target.value)}
              required
            />
          </label>
        )}

        {(kind === "sell" || kind === "obtain") && (
          <label>
            PT人数
            <input
              type="number"
              min="1"
              step="1"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
          </label>
        )}

        {kind === "sell" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isEventIncome}
              onChange={(e) => setIsEventIncome(e.target.checked)}
            />
            一時的な収入（イベント等）
          </label>
        )}
        {kind === "sell" && isEventIncome && (
          <p className="hint">
            欲しいものリストの週平均収入の見積りから、この売却は除外されます。
          </p>
        )}

        {(kind === "sell" || kind === "buy") && (
          <label>
            タグ（任意、スペース・カンマ区切りで複数可）
            <input
              placeholder="例: 周年イベント ○○鯖用"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </label>
        )}

        <div className="form-actions">
          <button type="submit">取引を記録する</button>
        </div>
      </form>
      <UnregisteredItemPrompt
        itemNames={unregisteredNames}
        onDone={() => setUnregisteredNames([])}
      />
    </>
  );
}
