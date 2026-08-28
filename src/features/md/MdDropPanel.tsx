import { useState, type FormEvent } from "react";
import { useMdRuns } from "./useMd";
import {
  useItemPrices,
  useInventory,
  usePartyObtains,
  usePartyMembers,
} from "../finance/useFinance";
import { useMvpMaster, useMvpKills } from "../mvp/useMvp";
import { parseClearTime } from "../../lib/date";
import { parseZeny } from "../../lib/zeny";
import { partyShare, parseMemberNames } from "../../lib/party";
import { MvpDefeatCheckboxes } from "./MvpDefeatCheckboxes";
import { defaultMvpDefeats } from "./ctCalc";
import { PartyMemberPicker } from "../../components/PartyMemberPicker";
import type { Character, MdDungeon } from "../../db/types";

interface Props {
  dungeon: MdDungeon;
  character: Character;
  onClose: () => void;
  onUnregisteredItems: (names: string[]) => void;
  onUnregisteredMvps: (names: string[]) => void;
}

export function MdDropPanel({
  dungeon,
  character,
  onClose,
  onUnregisteredItems,
  onUnregisteredMvps,
}: Props) {
  const { logRun } = useMdRuns();
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { addStock } = useInventory();
  const { addPartyObtain } = usePartyObtains();
  const { addPartyMember } = usePartyMembers();
  const { mvpMaster } = useMvpMaster();
  const { logKill } = useMvpKills();

  const itemNames = Object.keys(dungeon.items);
  const hasModes = (dungeon.modes?.length ?? 0) > 0;
  const [modeName, setModeName] = useState<string>(
    () => dungeon.modes?.[0]?.name ?? "",
  );
  const activeMobNames = hasModes
    ? (dungeon.modes?.find((m) => m.name === modeName)?.mvpMobs ?? [])
    : dungeon.mvpMobs;
  const [mvpDefeats, setMvpDefeats] = useState<Record<string, boolean>>(() =>
    defaultMvpDefeats(activeMobNames),
  );
  const [clearTime, setClearTime] = useState("");
  const [scoreInput, setScoreInput] = useState(
    dungeon.defaultScore !== undefined ? String(dungeon.defaultScore) : "",
  );
  const [roomsInput, setRoomsInput] = useState(
    dungeon.defaultRooms !== undefined ? String(dungeon.defaultRooms) : "",
  );
  const [partySize, setPartySize] = useState("1");
  const [partyMembersInput, setPartyMembersInput] = useState("");
  const [estimatedCostInput, setEstimatedCostInput] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      itemNames.map((name) => [name, String(dungeon.items[name] || 0)]),
    ),
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const party = Math.max(1, Number(partySize) || 1);

  function handleModeChange(name: string) {
    setModeName(name);
    const mobs = dungeon.modes?.find((m) => m.name === name)?.mvpMobs ?? [];
    setMvpDefeats(defaultMvpDefeats(mobs));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (clearTime.trim() && parseClearTime(clearTime) === undefined) {
      setError("クリア時間は mm:ss（例: 12:34）の形式で入力してください。");
      return;
    }

    const items: Record<string, number> = {};
    const totalQuantities: Record<string, number> = {};
    for (const name of itemNames) {
      const totalQty = Number(quantities[name] ?? "0");
      if (Number.isNaN(totalQty) || totalQty <= 0) continue;
      const myShare = partyShare(totalQty, party);
      if (myShare > 0) {
        items[name] = myShare;
        totalQuantities[name] = totalQty;
      }
    }

    setSubmitting(true);
    try {
      const completedAt = Date.now();
      const runId = await logRun({
        characterId: character.id,
        dungeonId: dungeon.id,
        completedAt,
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
        items,
        modeName: hasModes ? modeName : undefined,
        estimatedCost: estimatedCostInput.trim()
          ? parseZeny(estimatedCostInput)
          : undefined,
      });

      // MD連動: a defeated MOB whose name matches an MVP master entry logs a kill
      // automatically. Names are trimmed before comparing since MD MOB lists and
      // the MVP master are edited independently and can pick up stray whitespace.
      const mvpByName = new Map(
        (mvpMaster ?? []).map((m) => [m.name.trim(), m]),
      );
      const unmatchedMvpNames: string[] = [];
      for (const [mobName, defeated] of Object.entries(mvpDefeats)) {
        if (!defeated) continue;
        const trimmedName = mobName.trim();
        const mvp = mvpByName.get(trimmedName);
        if (!mvp) {
          unmatchedMvpNames.push(trimmedName);
          continue;
        }
        await logKill({
          mvpId: mvp.id,
          characterId: character.id,
          killedAt: completedAt,
          cardDropped: false,
        });
      }

      const knownNames = new Set((itemPrices ?? []).map((p) => p.itemName));
      const newlyUnregistered: string[] = [];
      const partyMembers = parseMemberNames(partyMembersInput);
      for (const member of partyMembers) await addPartyMember(member);
      for (const [name, qty] of Object.entries(items)) {
        if (!knownNames.has(name)) {
          await upsertItemPrice({ itemName: name, expectedPrice: 0 });
          newlyUnregistered.push(name);
        }
        // PT分配の場合は addStock で直接足すのではなく、"PT在庫一覧" が集計
        // する側の履歴として記録する（誰と何個ずつ分けたかをあとから振り返れる
        // ように）。ソロ（PT人数1）は今まで通り在庫に直接加算するだけ。
        if (party > 1) {
          await addPartyObtain({
            itemName: name,
            totalQuantity: totalQuantities[name],
            partySize: party,
            members: partyMembers,
            date: completedAt,
            memo: `MD周回: ${dungeon.name}`,
            sourceRunId: runId,
          });
        } else {
          await addStock(name, qty);
        }
      }

      onClose();
      if (newlyUnregistered.length > 0) onUnregisteredItems(newlyUnregistered);
      if (unmatchedMvpNames.length > 0) onUnregisteredMvps(unmatchedMvpNames);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form className="stacked-form" onSubmit={handleSubmit}>
        <h2>
          {character.name} - {dungeon.name}
        </h2>
        {error && <p className="form-error">{error}</p>}

        {hasModes && (
          <label>
            モード
            <select
              value={modeName}
              onChange={(e) => handleModeChange(e.target.value)}
            >
              {dungeon.modes?.map((m) => (
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

        {dungeon.tracksScore && (
          <label>
            得点
            <input
              type="number"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
            />
          </label>
        )}

        {dungeon.tracksRooms && (
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
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
        </label>

        {party > 1 && (
          <label>
            PTメンバー（自分以外、任意）
            <PartyMemberPicker
              value={partyMembersInput}
              onChange={setPartyMembersInput}
            />
            <span className="hint">
              獲得アイテムはこのメンバー構成で「PT在庫一覧」に履歴として残ります。
            </span>
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
        <p className="hint">
          入力すると、MD別効率分析の「純利益ベース」の時給に反映されます。
        </p>

        {itemNames.length > 0 && (
          <>
            <h3>獲得アイテム（パーティ全体の取得数）</h3>
            {itemNames.map((name) => {
              const totalQty = Number(quantities[name] ?? "0");
              const myShare = Number.isNaN(totalQty)
                ? 0
                : partyShare(totalQty, party);
              return (
                <label key={name}>
                  {name}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantities[name]}
                    onChange={(e) =>
                      setQuantities({ ...quantities, [name]: e.target.value })
                    }
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  {party > 1 && (
                    <span className="hint">→ 自分の取り分: {myShare}</span>
                  )}
                </label>
              );
            })}
          </>
        )}

        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            記録する
          </button>
          <button type="button" onClick={onClose} disabled={submitting}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
