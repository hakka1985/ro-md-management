import { useEffect, useState, type FormEvent } from "react";
import { useMvpKills, useMvpMaster } from "./useMvp";
import { useCharacters } from "../characters/useCharacters";
import { toDatetimeLocalValue, fromDatetimeLocalValue } from "../../lib/date";
import { MvpItemDropCheckboxes } from "./MvpItemDropCheckboxes";
import type { MvpKill } from "../../db/types";

const LAST_CHARACTER_KEY = "ro-md-management:lastCharacterName";

interface Props {
  editingKill: MvpKill | null;
  onDone: () => void;
}

export function MvpKillForm({ editingKill, onDone }: Props) {
  const { mvpMaster } = useMvpMaster();
  const { characters } = useCharacters();
  const { logKill, updateKill } = useMvpKills();

  const [mvpName, setMvpName] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [characterName, setCharacterName] = useState(
    () => localStorage.getItem(LAST_CHARACTER_KEY) || "",
  );
  const [killedAt, setKilledAt] = useState(() =>
    toDatetimeLocalValue(Date.now()),
  );
  const [cardDropped, setCardDropped] = useState(false);
  const [cardName, setCardName] = useState("");
  const [itemsDropped, setItemsDropped] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeMvps = mvpMaster?.filter((m) => !m.archived) ?? [];
  const activeCharacters = characters?.filter((c) => !c.archived) ?? [];
  const selectedMvp = activeMvps.find((m) => m.name === mvpName);
  const dropItemNames = selectedMvp?.dropItems ?? [];

  const mapFilterTrim = mapFilter.trim().toLowerCase();
  const mvpOptions = mapFilterTrim
    ? activeMvps.filter((m) =>
        (m.map ?? "").toLowerCase().includes(mapFilterTrim),
      )
    : activeMvps;

  useEffect(() => {
    if (!editingKill) return;
    const mvp = mvpMaster?.find((m) => m.id === editingKill.mvpId);
    const character = characters?.find((c) => c.id === editingKill.characterId);
    setMvpName(mvp?.name ?? "");
    setCharacterName(character?.name ?? "");
    setKilledAt(toDatetimeLocalValue(editingKill.killedAt));
    setCardDropped(editingKill.cardDropped);
    setCardName(editingKill.cardName ?? "");
    setItemsDropped(editingKill.itemsDropped ?? []);
    setMemo(editingKill.memo ?? "");
  }, [editingKill, mvpMaster, characters]);

  function handleMvpChange(value: string) {
    setMvpName(value);
    const matched = activeMvps.find((m) => m.name === value);
    if (matched && cardDropped && !cardName) {
      setCardName(matched.cardName ?? "");
    }
    setItemsDropped([]);
  }

  function handleCardDroppedChange(checked: boolean) {
    setCardDropped(checked);
    if (checked && !cardName) {
      const matched = activeMvps.find((m) => m.name === mvpName);
      setCardName(matched?.cardName ?? "");
    }
  }

  function resetForm() {
    setMvpName("");
    setKilledAt(toDatetimeLocalValue(Date.now()));
    setCardDropped(false);
    setCardName("");
    setItemsDropped([]);
    setMemo("");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const mvp = activeMvps.find((m) => m.name === mvpName);
    if (!mvp) {
      setError(
        "MVPを一覧から選択してください（未登録の名前は下の「MVPマスタ管理」から追加できます）。",
      );
      return;
    }
    const character = activeCharacters.find((c) => c.name === characterName);
    if (characterName && !character) {
      setError("キャラクターが見つかりません。未入力のままでも記録できます。");
      return;
    }

    const payload = {
      mvpId: mvp.id,
      characterId: character?.id,
      killedAt: fromDatetimeLocalValue(killedAt),
      cardDropped,
      cardName: cardName.trim() || undefined,
      itemsDropped: itemsDropped.length > 0 ? itemsDropped : undefined,
      memo: memo.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editingKill) {
        await updateKill(editingKill.id, payload);
        onDone();
      } else {
        await logKill(payload);
        if (characterName)
          localStorage.setItem(LAST_CHARACTER_KEY, characterName);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel stacked-form" onSubmit={handleSubmit}>
      <h2>{editingKill ? "討伐記録を編集" : "MVP討伐を記録"}</h2>
      {error && <p className="form-error">{error}</p>}

      <label>
        出現マップで絞り込み（任意）
        <input
          placeholder="マップ名の一部を入力するとMVP候補を絞り込めます"
          value={mapFilter}
          onChange={(e) => setMapFilter(e.target.value)}
        />
      </label>

      <label>
        MVP
        <input
          list="mvp-options"
          value={mvpName}
          onChange={(e) => handleMvpChange(e.target.value)}
          autoFocus
          required
        />
        <datalist id="mvp-options">
          {mvpOptions.map((m) => (
            <option key={m.id} value={m.name}>
              {m.map}
            </option>
          ))}
        </datalist>
        {mapFilterTrim && mvpOptions.length === 0 && (
          <span className="hint">
            「{mapFilter}」を含む出現マップのMVPが見つかりません
          </span>
        )}
      </label>

      <label>
        キャラクター（任意）
        <input
          list="character-options"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
        />
        <datalist id="character-options">
          {activeCharacters.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <label>
        討伐日時
        <input
          type="datetime-local"
          value={killedAt}
          onChange={(e) => setKilledAt(e.target.value)}
          required
        />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={cardDropped}
          onChange={(e) => handleCardDroppedChange(e.target.checked)}
        />
        カードドロップあり
      </label>

      {cardDropped && (
        <label>
          カード名
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
          />
        </label>
      )}

      <MvpItemDropCheckboxes
        itemNames={dropItemNames}
        value={itemsDropped}
        onChange={setItemsDropped}
      />

      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {editingKill ? "更新する" : "今すぐ記録する"}
        </button>
        {editingKill && (
          <button type="button" onClick={onDone} disabled={submitting}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
