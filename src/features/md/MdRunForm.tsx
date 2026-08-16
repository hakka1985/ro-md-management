import { useEffect, useState, type FormEvent } from "react";
import { useMdDungeons, useMdRuns } from "./useMd";
import { useCharacters } from "../characters/useCharacters";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  parseClearTime,
  formatClearTime,
} from "../../lib/date";
import { parseZeny } from "../../lib/zeny";
import { MvpDefeatCheckboxes } from "./MvpDefeatCheckboxes";
import { defaultMvpDefeats } from "./ctCalc";
import type { MdRun } from "../../db/types";

const LAST_CHARACTER_KEY = "ro-md-management:lastCharacterName";

interface Props {
  editingRun: MdRun | null;
  onDone: () => void;
}

export function MdRunForm({ editingRun, onDone }: Props) {
  const { dungeons } = useMdDungeons();
  const { characters } = useCharacters();
  const { logRun, updateRun } = useMdRuns();

  const [dungeonName, setDungeonName] = useState("");
  const [characterName, setCharacterName] = useState(
    () => localStorage.getItem(LAST_CHARACTER_KEY) || "",
  );
  const [completedAt, setCompletedAt] = useState(() =>
    toDatetimeLocalValue(Date.now()),
  );
  const [mvpDefeats, setMvpDefeats] = useState<Record<string, boolean>>({});
  const [clearTime, setClearTime] = useState("");
  const [memo, setMemo] = useState("");
  const [modeName, setModeName] = useState("");
  const [estimatedCostInput, setEstimatedCostInput] = useState("");
  const [error, setError] = useState("");

  const activeDungeons = dungeons?.filter((d) => !d.archived) ?? [];
  const activeCharacters = characters?.filter((c) => !c.archived) ?? [];
  const matchedDungeon = activeDungeons.find((d) => d.name === dungeonName);
  const hasModes = (matchedDungeon?.modes?.length ?? 0) > 0;
  const activeMobNames = hasModes
    ? (matchedDungeon?.modes?.find((m) => m.name === modeName)?.mvpMobs ?? [])
    : (matchedDungeon?.mvpMobs ?? []);

  useEffect(() => {
    if (!editingRun) return;
    const dungeon = dungeons?.find((d) => d.id === editingRun.dungeonId);
    const character = characters?.find((c) => c.id === editingRun.characterId);
    setDungeonName(dungeon?.name ?? "");
    setCharacterName(character?.name ?? "");
    setCompletedAt(toDatetimeLocalValue(editingRun.completedAt));
    setMvpDefeats(editingRun.mvpDefeats);
    setClearTime(
      editingRun.clearTimeSeconds !== undefined
        ? formatClearTime(editingRun.clearTimeSeconds)
        : "",
    );
    setMemo(editingRun.memo ?? "");
    setModeName(editingRun.modeName ?? dungeon?.modes?.[0]?.name ?? "");
    setEstimatedCostInput(
      editingRun.estimatedCost ? String(editingRun.estimatedCost) : "",
    );
  }, [editingRun, dungeons, characters]);

  useEffect(() => {
    if (editingRun) return;
    const dungeon = activeDungeons.find((d) => d.name === dungeonName);
    const firstMode = dungeon?.modes?.[0]?.name ?? "";
    setModeName(firstMode);
    setMvpDefeats(
      defaultMvpDefeats(
        firstMode
          ? (dungeon?.modes?.[0]?.mvpMobs ?? [])
          : (dungeon?.mvpMobs ?? []),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeonName, dungeons]);

  function handleModeChange(name: string) {
    setModeName(name);
    const mobs = matchedDungeon?.modes?.find((m) => m.name === name)?.mvpMobs ?? [];
    setMvpDefeats(defaultMvpDefeats(mobs));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const dungeon = activeDungeons.find((d) => d.name === dungeonName);
    if (!dungeon) {
      setError(
        "MDを一覧から選択してください（未登録の場合はMDマスタタブから追加できます）。",
      );
      return;
    }
    const character = activeCharacters.find((c) => c.name === characterName);
    if (!character) {
      setError(
        "キャラクターを一覧から選択してください（設定タブから追加できます）。",
      );
      return;
    }
    if (clearTime.trim() && parseClearTime(clearTime) === undefined) {
      setError("クリア時間は mm:ss（例: 12:34）の形式で入力してください。");
      return;
    }

    const payload = {
      dungeonId: dungeon.id,
      characterId: character.id,
      completedAt: fromDatetimeLocalValue(completedAt),
      mvpDefeats,
      clearTimeSeconds: parseClearTime(clearTime),
      memo: memo.trim() || undefined,
      modeName: (dungeon.modes?.length ?? 0) > 0 ? modeName : undefined,
      estimatedCost: estimatedCostInput.trim()
        ? parseZeny(estimatedCostInput)
        : undefined,
    };

    if (editingRun) {
      await updateRun(editingRun.id, payload);
    } else {
      await logRun(payload);
      localStorage.setItem(LAST_CHARACTER_KEY, characterName);
    }
    onDone();
  }

  return (
    <form className="panel stacked-form" onSubmit={handleSubmit}>
      <h2>{editingRun ? "周回記録を編集" : "MDクリアを記録"}</h2>
      {error && <p className="form-error">{error}</p>}

      <label>
        MD
        <input
          list="md-dungeon-options"
          value={dungeonName}
          onChange={(e) => setDungeonName(e.target.value)}
          autoFocus
          required
        />
        <datalist id="md-dungeon-options">
          {activeDungeons.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
      </label>

      <label>
        キャラクター
        <input
          list="md-character-options"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          required
        />
        <datalist id="md-character-options">
          {activeCharacters.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <label>
        クリア日時
        <input
          type="datetime-local"
          value={completedAt}
          onChange={(e) => setCompletedAt(e.target.value)}
          required
        />
      </label>

      {hasModes && (
        <label>
          モード
          <select
            value={modeName}
            onChange={(e) => handleModeChange(e.target.value)}
          >
            {matchedDungeon?.modes?.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <MvpDefeatCheckboxes
        mobNames={activeMobNames}
        value={mvpDefeats}
        onChange={setMvpDefeats}
      />

      <label>
        クリア時間（任意、mm:ss）
        <input
          placeholder="例: 12:34"
          value={clearTime}
          onChange={(e) => setClearTime(e.target.value)}
        />
      </label>

      <label>
        消耗品コスト（任意、例: 10k）
        <input
          placeholder="ポーション・素材等の想定金額"
          value={estimatedCostInput}
          onChange={(e) => setEstimatedCostInput(e.target.value)}
        />
      </label>

      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit">{editingRun ? "更新する" : "記録する"}</button>
        <button type="button" onClick={onDone}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
