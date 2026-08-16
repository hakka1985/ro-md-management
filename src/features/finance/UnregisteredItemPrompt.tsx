import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { useItemPrices } from "./useFinance";
import { parseZeny } from "../../lib/zeny";

interface Props {
  itemNames: string[];
  onDone: () => void;
}

/** Prompts to set a price/URL for items that got auto-registered at 0 by a trade/MD-drop save — non-blocking, appears after the record is already saved. */
export function UnregisteredItemPrompt({ itemNames, onDone }: Props) {
  const { upsertItemPrice } = useItemPrices();
  const [index, setIndex] = useState(0);
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");

  const current = itemNames[index];

  function advance() {
    setPrice("");
    setUrl("");
    if (index + 1 < itemNames.length) {
      setIndex(index + 1);
    } else {
      onDone();
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await upsertItemPrice({
      itemName: current,
      expectedPrice: parseZeny(price),
      url: url.trim() || undefined,
    });
    advance();
  }

  return (
    <Modal open={itemNames.length > 0} onClose={onDone}>
      {current && (
        <form className="stacked-form" onSubmit={handleSave}>
          <h2>「{current}」は未登録です</h2>
          <p className="hint">
            想定単価を設定するとダッシュボードや効率分析に反映されます（あとで「アイテムマスタ」タブから編集することもできます）。
          </p>
          <label>
            想定単価（例: 10k）
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            URL（任意）
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="submit">登録する</button>
            <button type="button" onClick={advance}>
              あとで
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
