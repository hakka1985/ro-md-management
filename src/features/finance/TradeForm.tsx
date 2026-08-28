import { useState, type FormEvent } from "react";
import {
  useItemPrices,
  useInventory,
  useTransactions,
  useDebts,
  usePartyObtains,
  usePartyMembers,
} from "./useFinance";
import { parseZeny, formatZ } from "../../lib/zeny";
import { parseMemberNames } from "../../lib/party";
import { UnregisteredItemPrompt } from "./UnregisteredItemPrompt";
import { PartyMemberPicker } from "../../components/PartyMemberPicker";
import type { FinanceType } from "../../db/types";

type TradeKind = "sell" | "buy" | "obtain" | "consume";

export function TradeForm() {
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { inventory, addStock, removeStock } = useInventory();
  const { addTransaction } = useTransactions();
  const { addDebt } = useDebts();
  const { addPartyObtain } = usePartyObtains();
  const { addPartyMember } = usePartyMembers();

  const [kind, setKind] = useState<TradeKind>("sell");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [partyMembersInput, setPartyMembersInput] = useState("");
  const [isEventIncome, setIsEventIncome] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [unregisteredNames, setUnregisteredNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const activeItems = itemPrices?.filter((p) => !p.archived) ?? [];
  const inStock = inventory?.filter((i) => i.quantity > 0) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
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

    setSubmitting(true);
    try {
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
        const saleDate = Date.now();
        await addTransaction({
          type: "income" as FinanceType,
          itemName: name,
          quantity: qty,
          unitPrice: recordedUnitPrice,
          amount,
          date: saleDate,
          source: "market",
          partySize: party,
          isEventIncome,
          tags,
        });
        // The seller (this account) holds the full sale amount at first, so
        // each named member's share is money owed *to* them, not yet handed
        // over — "borrowed" (負債) so it reduces total assets until repaid,
        // mirroring "this cash isn't fully mine yet."
        const partyMembers = parseMemberNames(partyMembersInput);
        for (const member of partyMembers) {
          // Free-typed names not already in the PT member master are
          // registered automatically — addPartyMember no-ops for a name
          // that's already there, so this is safe to call every time.
          await addPartyMember(member);
          await addDebt({
            direction: "borrowed",
            counterparty: member,
            amount,
            date: saleDate,
            memo: `PT分配（${name} 売却分）`,
          });
        }
        setMessage(
          party > 1
            ? `売却を記録しました（PT${party}人で分配、記録額 ${formatZ(amount)}）。${partyMembers.length > 0 ? `${partyMembers.join("・")}への分配分（各${formatZ(amount)}）を「貸し借り」に記録しました。` : ""}`
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
        // transaction. Solo (party === 1) just bumps inventory directly; a
        // PT-shared pickup instead goes through usePartyObtains, which keeps
        // a real per-event history (item/total/party/members/myShare) that
        // "PT在庫一覧" aggregates from, instead of blending untraceably into
        // the plain stock counter.
        if (!activeItems.some((p) => p.itemName === name)) {
          await upsertItemPrice({ itemName: name, expectedPrice: 0 });
          setUnregisteredNames((prev) => [...prev, name]);
        }
        if (party > 1) {
          const members = parseMemberNames(partyMembersInput);
          for (const member of members) await addPartyMember(member);
          const myShare = await addPartyObtain({
            itemName: name,
            totalQuantity: qty,
            partySize: party,
            members,
            date: Date.now(),
          });
          setMessage(
            `入手を記録しました（PT${party}人で分配、自分の取り分 ${myShare}個を在庫に追加、取引記録には計上されません。「PT在庫一覧」に履歴が残ります）。`,
          );
        } else {
          await addStock(name, qty);
          setMessage(
            `入手を記録しました（${qty}個を在庫に追加、取引記録には計上されません）。`,
          );
        }
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
      setPartyMembersInput("");
      setIsEventIncome(false);
      setTagsInput("");
    } finally {
      setSubmitting(false);
    }
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

        {kind === "sell" && Number(partySize) > 1 && (
          <label>
            PTメンバー（分配相手、任意）
            <PartyMemberPicker
              value={partyMembersInput}
              onChange={setPartyMembersInput}
            />
            <span className="hint">
              選択・入力すると、それぞれに分配額（
              {formatZ(
                Math.floor(
                  parseZeny(unitPriceInput) /
                    Math.max(1, Number(partySize) || 1),
                ) * Number(quantity || "0"),
              )}
              ）分の「貸し借り」（負債）が自動で記録されます。「貸し借り」タブで
              支払い済みを記録できます。
            </span>
          </label>
        )}
        {kind === "obtain" && Number(partySize) > 1 && (
          <label>
            PTメンバー（自分以外、任意）
            <PartyMemberPicker
              value={partyMembersInput}
              onChange={setPartyMembersInput}
            />
            <span className="hint">
              入力した個数をPT人数で割った、自分の取り分だけが在庫に加算されます
              （割り切れない場合は小数点のまま）。この入手は「PT在庫一覧」に
              履歴として残ります。
            </span>
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
          <button type="submit" disabled={submitting}>
            取引を記録する
          </button>
        </div>
      </form>
      <UnregisteredItemPrompt
        itemNames={unregisteredNames}
        onDone={() => setUnregisteredNames([])}
      />
    </>
  );
}
