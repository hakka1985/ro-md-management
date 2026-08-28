import { useEffect, useState, type FormEvent } from "react";
import { useMdDungeons, useMdRuns } from "./useMd";
import { useCharacters } from "../characters/useCharacters";
import {
  useItemPrices,
  useInventory,
  usePartyMembers,
} from "../finance/useFinance";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  parseClearTime,
  formatClearTime,
} from "../../lib/date";
import { parseZeny } from "../../lib/zeny";
import { parseMemberNames } from "../../lib/party";
import { MvpDefeatCheckboxes } from "./MvpDefeatCheckboxes";
import { PartyMemberPicker } from "../../components/PartyMemberPicker";
import { defaultMvpDefeats } from "./ctCalc";
import type { MdRun } from "../../db/types";

const LAST_CHARACTER_KEY = "ro-md-management:lastCharacterName";

interface Props {
  editingRun: MdRun | null;
  onDone: () => void;
  onUnregisteredItems?: (names: string[]) => void;
}

export function MdRunForm({ editingRun, onDone, onUnregisteredItems }: Props) {
  const { dungeons } = useMdDungeons();
  const { characters } = useCharacters();
  const { logRun, updateRun } = useMdRuns();
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { addStock } = useInventory();
  const { addPartyMember } = usePartyMembers();

  const [dungeonName, setDungeonName] = useState("");
  const [characterName, setCharacterName] = useState(
    () => localStorage.getItem(LAST_CHARACTER_KEY) || "",
  );
  const [completedAt, setCompletedAt] = useState(() =>
    toDatetimeLocalValue(Date.now()),
  );
  const [mvpDefeats, setMvpDefeats] = useState<Record<string, boolean>>({});
  const [clearTime, setClearTime] = useState("");
  const [scoreInput, setScoreInput] = useState("");
  const [roomsInput, setRoomsInput] = useState("");
  const [partySizeInput, setPartySizeInput] = useState("1");
  const [partyMembersInput, setPartyMembersInput] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [memo, setMemo] = useState("");
  const [modeName, setModeName] = useState("");
  const [estimatedCostInput, setEstimatedCostInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeDungeons = dungeons?.filter((d) => !d.archived) ?? [];
  const activeCharacters = characters?.filter((c) => !c.archived) ?? [];
  const matchedDungeon = activeDungeons.find((d) => d.name === dungeonName);
  const hasModes = (matchedDungeon?.modes?.length ?? 0) > 0;
  const activeMobNames = hasModes
    ? (matchedDungeon?.modes?.find((m) => m.name === modeName)?.mvpMobs ?? [])
    : (matchedDungeon?.mvpMobs ?? []);
  const party = Math.max(1, Number(partySizeInput) || 1);
  // Union with whatever's already in `quantities` so a previously-recorded
  // item stays editable even if the dungeon's item master list later
  // dropped it (edit mode loads straight from the run, not from the
  // current master list).
  const itemNames = [
    ...new Set([
      ...(matchedDungeon ? Object.keys(matchedDungeon.items) : []),
      ...Object.keys(quantities),
    ]),
  ];

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
    setScoreInput(
      editingRun.score !== undefined ? String(editingRun.score) : "",
    );
    setRoomsInput(
      editingRun.rooms !== undefined ? String(editingRun.rooms) : "",
    );
    setModeName(editingRun.modeName ?? dungeon?.modes?.[0]?.name ?? "");
    setEstimatedCostInput(
      editingRun.estimatedCost ? String(editingRun.estimatedCost) : "",
    );
    setPartySizeInput(String(editingRun.partySize ?? 1));
    setPartyMembersInput((editingRun.partyMembers ?? []).join(" "));
    const names = new Set([
      ...Object.keys(dungeon?.items ?? {}),
      ...Object.keys(editingRun.items ?? {}),
    ]);
    setQuantities(
      Object.fromEntries(
        [...names].map((name) => [name, String(editingRun.items?.[name] ?? 0)]),
      ),
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
    setQuantities(
      Object.fromEntries(
        Object.entries(dungeon?.items ?? {}).map(([name, qty]) => [
          name,
          String(qty || 0),
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeonName, dungeons]);

  function handleModeChange(name: string) {
    setModeName(name);
    const mobs =
      matchedDungeon?.modes?.find((m) => m.name === name)?.mvpMobs ?? [];
    setMvpDefeats(defaultMvpDefeats(mobs));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
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

    const items: Record<string, number> = {};
    for (const name of itemNames) {
      const qty = Number(quantities[name] ?? "0");
      if (!Number.isNaN(qty) && qty > 0) items[name] = qty;
    }
    const partyMembers = party > 1 ? parseMemberNames(partyMembersInput) : [];

    const payload = {
      dungeonId: dungeon.id,
      characterId: character.id,
      completedAt: fromDatetimeLocalValue(completedAt),
      mvpDefeats,
      clearTimeSeconds: parseClearTime(clearTime),
      score:
        dungeon.tracksScore && scoreInput.trim()
          ? Number(scoreInput)
          : undefined,
      rooms:
        dungeon.tracksRooms && roomsInput.trim()
          ? Number(roomsInput)
          : undefined,
      items: Object.keys(items).length > 0 ? items : undefined,
      memo: memo.trim() || undefined,
      modeName: (dungeon.modes?.length ?? 0) > 0 ? modeName : undefined,
      estimatedCost: estimatedCostInput.trim()
        ? parseZeny(estimatedCostInput)
        : undefined,
      partySize: party > 1 ? party : undefined,
      partyMembers: partyMembers.length > 0 ? partyMembers : undefined,
    };

    setSubmitting(true);
    try {
      for (const member of partyMembers) await addPartyMember(member);

      if (editingRun) {
        // Editing only patches this run's own record — it does not touch
        // inventory or any linked PT在庫一覧 entry (matches 削除 behavior).
        // Actual stock corrections belong in 取引・在庫 / PT在庫一覧.
        await updateRun(editingRun.id, payload);
      } else {
        await logRun(payload);
        localStorage.setItem(LAST_CHARACTER_KEY, characterName);

        if (Object.keys(items).length > 0) {
          const knownNames = new Set((itemPrices ?? []).map((p) => p.itemName));
          const newlyUnregistered: string[] = [];
          for (const [name, qty] of Object.entries(items)) {
            if (!knownNames.has(name)) {
              await upsertItemPrice({ itemName: name, expectedPrice: 0 });
              newlyUnregistered.push(name);
            }
            await addStock(name, qty);
          }
          if (newlyUnregistered.length > 0)
            onUnregisteredItems?.(newlyUnregistered);
        }
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
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

      {matchedDungeon?.tracksScore && (
        <label>
          得点
          <input
            type="number"
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
          />
        </label>
      )}

      {matchedDungeon?.tracksRooms && (
        <label>
          踏破部屋数
          <input
            type="number"
            min="0"
            step="1"
            value={roomsInput}
            onChange={(e) => setRoomsInput(e.target.value)}
          />
        </label>
      )}

      <label>
        PT人数
        <input
          type="number"
          min="1"
          step="1"
          value={partySizeInput}
          onChange={(e) => setPartySizeInput(e.target.value)}
        />
      </label>

      {party > 1 && (
        <label>
          PTメンバー（自分以外、任意）
          <PartyMemberPicker
            value={partyMembersInput}
            onChange={setPartyMembersInput}
          />
        </label>
      )}

      <label>
        消耗品コスト（任意、例: 10k）
        <input
          placeholder="ポーション・素材等の想定金額"
          value={estimatedCostInput}
          onChange={(e) => setEstimatedCostInput(e.target.value)}
        />
      </label>

      {itemNames.length > 0 && (
        <>
          <h3>獲得アイテム（自分の取り分の数量）</h3>
          {editingRun && (
            <p className="hint">
              ここでの数量・PT人数の修正は、この周回記録自体の内容のみを直します（在庫やPT在庫一覧の数値は連動して変更されません。実際の在庫を直す場合は「取引・在庫」またはPT在庫一覧から調整してください）。
            </p>
          )}
          {itemNames.map((name) => (
            <label key={name}>
              {name}
              <input
                type="number"
                min="0"
                step="1"
                value={quantities[name] ?? "0"}
                onChange={(e) =>
                  setQuantities({ ...quantities, [name]: e.target.value })
                }
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          ))}
        </>
      )}

      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {editingRun ? "更新する" : "記録する"}
        </button>
        <button type="button" onClick={onDone} disabled={submitting}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
