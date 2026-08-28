import { useState, type FormEvent } from "react";
import { useMdDungeons, useMdRuns } from "./useMd";
import { useCharacters } from "../characters/useCharacters";
import { useItemPrices, useInventory } from "../finance/useFinance";
import { useMvpMaster, useMvpKills } from "../mvp/useMvp";
import { parseClearTime } from "../../lib/date";
import { parseZeny } from "../../lib/zeny";
import { MvpDefeatCheckboxes } from "./MvpDefeatCheckboxes";
import { defaultMvpDefeats, isMdExcluded } from "./ctCalc";

interface Props {
  onClose: () => void;
  onUnregisteredItems: (names: string[]) => void;
  onUnregisteredMvps: (names: string[]) => void;
}

/**
 * Records the same MD clear (drops, MVP defeats, clear time) for several
 * characters at once — e.g. daily mules that all solo the same MD for the
 * same guaranteed reward. Each selected character gets its own independent
 * MdRun with identical item counts (not party-split, since each character
 * is assumed to have earned the full amount on their own run).
 */
export function MdBulkRecordPanel({
  onClose,
  onUnregisteredItems,
  onUnregisteredMvps,
}: Props) {
  const { dungeons } = useMdDungeons();
  const { characters } = useCharacters();
  const { logRun } = useMdRuns();
  const { itemPrices, upsertItemPrice } = useItemPrices();
  const { addStock } = useInventory();
  const { mvpMaster } = useMvpMaster();
  const { logKill } = useMvpKills();

  const activeDungeons = dungeons.filter((d) => !d.archived);
  const activeCharacters = characters.filter((c) => !c.archived);

  const [dungeonName, setDungeonName] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(
    new Set(),
  );
  const [modeName, setModeName] = useState("");
  const [mvpDefeats, setMvpDefeats] = useState<Record<string, boolean>>({});
  const [clearTime, setClearTime] = useState("");
  const [scoreInput, setScoreInput] = useState("");
  const [roomsInput, setRoomsInput] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [estimatedCostInput, setEstimatedCostInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dungeon = activeDungeons.find((d) => d.name === dungeonName) ?? null;
  const hasModes = (dungeon?.modes?.length ?? 0) > 0;
  const activeMobNames = hasModes
    ? (dungeon?.modes?.find((m) => m.name === modeName)?.mvpMobs ?? [])
    : (dungeon?.mvpMobs ?? []);
  const itemNames = dungeon ? Object.keys(dungeon.items) : [];
  const eligibleCharacters = dungeon
    ? activeCharacters.filter((c) => !isMdExcluded(dungeon, c))
    : [];

  function handleDungeonChange(name: string) {
    setDungeonName(name);
    const d = activeDungeons.find((x) => x.name === name) ?? null;
    const firstMode = d?.modes?.[0]?.name ?? "";
    setModeName(firstMode);
    const mobs = firstMode
      ? (d?.modes?.[0]?.mvpMobs ?? [])
      : (d?.mvpMobs ?? []);
    setMvpDefeats(defaultMvpDefeats(mobs));
    setScoreInput(d?.defaultScore !== undefined ? String(d.defaultScore) : "");
    setRoomsInput(d?.defaultRooms !== undefined ? String(d.defaultRooms) : "");
    setQuantities(
      Object.fromEntries(
        Object.entries(d?.items ?? {}).map(([name, qty]) => [
          name,
          String(qty || 0),
        ]),
      ),
    );
    setSelectedCharacterIds(new Set());
  }

  function handleModeChange(name: string) {
    setModeName(name);
    const mobs = dungeon?.modes?.find((m) => m.name === name)?.mvpMobs ?? [];
    setMvpDefeats(defaultMvpDefeats(mobs));
  }

  function toggleCharacter(id: string) {
    setSelectedCharacterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedCharacterIds((prev) =>
      prev.size === eligibleCharacters.length
        ? new Set()
        : new Set(eligibleCharacters.map((c) => c.id)),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!dungeon) {
      setError("MDを選択してください。");
      return;
    }
    if (selectedCharacterIds.size === 0) {
      setError("キャラクターを1人以上選択してください。");
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
    const estimatedCost = estimatedCostInput.trim()
      ? parseZeny(estimatedCostInput)
      : undefined;
    const clearTimeSeconds = parseClearTime(clearTime);
    const score =
      dungeon.tracksScore && scoreInput.trim() ? Number(scoreInput) : undefined;
    const rooms =
      dungeon.tracksRooms && roomsInput.trim() ? Number(roomsInput) : undefined;

    const mvpByName = new Map((mvpMaster ?? []).map((m) => [m.name.trim(), m]));
    const unmatchedMvpNames = new Set<string>();
    const knownItemNames = new Set((itemPrices ?? []).map((p) => p.itemName));
    const newlyUnregistered = new Set<string>();

    setSubmitting(true);
    try {
      for (const characterId of selectedCharacterIds) {
        const completedAt = Date.now();
        await logRun({
          characterId,
          dungeonId: dungeon.id,
          completedAt,
          mvpDefeats,
          clearTimeSeconds,
          score,
          rooms,
          items,
          modeName: hasModes ? modeName : undefined,
          estimatedCost,
        });

        for (const [mobName, defeated] of Object.entries(mvpDefeats)) {
          if (!defeated) continue;
          const trimmedName = mobName.trim();
          const mvp = mvpByName.get(trimmedName);
          if (!mvp) {
            unmatchedMvpNames.add(trimmedName);
            continue;
          }
          await logKill({
            mvpId: mvp.id,
            characterId,
            killedAt: completedAt,
            cardDropped: false,
          });
        }

        for (const [name, qty] of Object.entries(items)) {
          if (!knownItemNames.has(name)) {
            await upsertItemPrice({ itemName: name, expectedPrice: 0 });
            knownItemNames.add(name);
            newlyUnregistered.add(name);
          }
          await addStock(name, qty);
        }
      }

      setMessage(
        `${selectedCharacterIds.size}人分の周回を記録しました（${dungeon.name}）。`,
      );
      setSelectedCharacterIds(new Set());
      if (newlyUnregistered.size > 0)
        onUnregisteredItems([...newlyUnregistered]);
      if (unmatchedMvpNames.size > 0)
        onUnregisteredMvps([...unmatchedMvpNames]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>複数キャラ一括記録</h2>
      <p className="hint">
        同じMDを複数キャラでそれぞれソロ周回した場合など、同じ内容を選んだキャラ全員分まとめて記録します（PT分配はされず、各キャラに入力した数量がそのまま記録されます）。
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-message">{message}</p>}

      <label>
        MD
        <input
          list="md-bulk-dungeon-options"
          value={dungeonName}
          onChange={(e) => handleDungeonChange(e.target.value)}
          required
        />
        <datalist id="md-bulk-dungeon-options">
          {activeDungeons.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
      </label>

      {dungeon && hasModes && (
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

      {dungeon && (
        <>
          <div className="stacked-form" style={{ gap: "0.3rem" }}>
            <div className="inline-form" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                対象キャラ（{selectedCharacterIds.size}/
                {eligibleCharacters.length}人選択中）
              </span>
              <button type="button" onClick={toggleSelectAll}>
                {selectedCharacterIds.size === eligibleCharacters.length
                  ? "全解除"
                  : "全選択"}
              </button>
            </div>
            {eligibleCharacters.length === 0 ? (
              <p className="empty">このMDに行けるキャラがいません。</p>
            ) : (
              eligibleCharacters.map((c) => (
                <label key={c.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedCharacterIds.has(c.id)}
                    onChange={() => toggleCharacter(c.id)}
                  />
                  {c.name}
                </label>
              ))
            )}
          </div>

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
            消耗品コスト（任意、1人あたりの想定金額）
            <input
              placeholder="例: 10k"
              value={estimatedCostInput}
              onChange={(e) => setEstimatedCostInput(e.target.value)}
            />
          </label>

          {itemNames.length > 0 && (
            <>
              <h3>獲得アイテム（1人あたりの数量）</h3>
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
        </>
      )}

      <div className="form-actions">
        <button type="submit" disabled={!dungeon || submitting}>
          まとめて記録する
        </button>
        <button type="button" onClick={onClose} disabled={submitting}>
          閉じる
        </button>
      </div>
    </form>
  );
}
