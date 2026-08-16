import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { useMvpMaster } from "./useMvp";

interface Props {
  mvpNames: string[];
  onDone: () => void;
}

/** Prompts to register MVP master entries for MOB names that were checked as defeated during an MD run but didn't match any existing MVP (by exact name) — without a match, MD連動 can't auto-log a kill, so this closes the gap right where it was noticed. Non-blocking, appears after the run is already saved. */
export function UnregisteredMvpPrompt({ mvpNames, onDone }: Props) {
  const { addMvp } = useMvpMaster();
  const [index, setIndex] = useState(0);
  const [cardName, setCardName] = useState("");
  const [error, setError] = useState("");

  const current = mvpNames[index];

  function advance() {
    setCardName("");
    setError("");
    if (index + 1 < mvpNames.length) {
      setIndex(index + 1);
    } else {
      onDone();
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const result = await addMvp({
      name: current,
      cardName: cardName.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    advance();
  }

  return (
    <Modal open={mvpNames.length > 0} onClose={onDone}>
      {current && (
        <form className="stacked-form" onSubmit={handleSave}>
          <h2>「{current}」はMVPマスタ未登録です</h2>
          <p className="hint">
            MDの討伐チェックで「{current}」を討伐済みにしましたが、MVPマスタに同じ名前の
            MVPが見つからなかったため、MVP討伐として自動記録されませんでした。ここで登録すると
            次回から自動で討伐カウントされます（あとで「MVPマスタ」タブから登録することもできます）。
          </p>
          {error && <p className="form-error">{error}</p>}
          <label>
            カード名（任意）
            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              autoFocus
            />
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
