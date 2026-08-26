import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import { useMdDungeons, useMdRuns } from "./useMd";
import { useCharacters } from "../characters/useCharacters";
import { useInventory, usePartyObtains } from "../finance/useFinance";
import { useAppSettings } from "../settings/useAppSettings";
import {
  getCtStatus,
  getLatestRun,
  formatRemaining,
  getCtLabel,
  getCtBadgeClass,
  getAccountRunCount,
  isLevelExcluded,
  isMdExcluded,
  getAllMvpMobNames,
  pickBestMdRecord,
  type MdRecordCandidate,
} from "./ctCalc";
import { formatClearTime } from "../../lib/date";
import { MdDropPanel } from "./MdDropPanel";
import { MdRunForm } from "./MdRunForm";
import { MdBulkRecordPanel } from "./MdBulkRecordPanel";
import { Modal } from "../../components/Modal";
import { UnregisteredItemPrompt } from "../finance/UnregisteredItemPrompt";
import { UnregisteredMvpPrompt } from "../mvp/UnregisteredMvpPrompt";
import type { Character, MdDungeon } from "../../db/types";

interface ActiveCell {
  dungeon: MdDungeon;
  character: Character;
}

interface DungeonStats {
  mobKillCounts: { mob: string; count: number }[];
  bestRecord: MdRecordCandidate | null;
  eligibleCount: number;
  doneCount: number;
}

/** "最高記録: 得点1200・部屋8・12:34" for a dungeon tracking score/rooms, or the plain "最速12:34" wording every dungeon already had — null when there's nothing to show yet. */
function dungeonRecordLabel(
  dungeon: MdDungeon,
  record: MdRecordCandidate | null,
): string | null {
  if (!record) return null;
  if (!dungeon.tracksScore && !dungeon.tracksRooms) {
    return record.clearTimeSeconds !== undefined
      ? `最速${formatClearTime(record.clearTimeSeconds)}`
      : null;
  }
  const parts = [
    dungeon.tracksScore && record.score !== undefined ? `得点${record.score}` : null,
    dungeon.tracksRooms && record.rooms !== undefined ? `部屋${record.rooms}` : null,
    record.clearTimeSeconds !== undefined
      ? formatClearTime(record.clearTimeSeconds)
      : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? `最高記録: ${parts.join("・")}` : null;
}

export interface MdRecordTarget {
  dungeonId: string;
  characterId: string;
}

interface Props {
  pendingRecordTarget?: MdRecordTarget | null;
  onConsumeRecordTarget?: () => void;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function characterSubLabel(c: Character): string {
  const parts = [
    c.job,
    c.level ? `Lv${c.level}` : null,
    c.server,
    c.account ? `垢:${c.account}` : null,
  ].filter((p): p is string => !!p);
  return parts.join(" / ");
}

export function MdGrid({ pendingRecordTarget, onConsumeRecordTarget }: Props) {
  const { dungeons, toggleExclusion, reorderDungeon } = useMdDungeons();
  const { runs, deleteRun } = useMdRuns();
  const { characters, updateCharacter, reorderCharacter } = useCharacters();
  const { removeStock } = useInventory();
  const { entries: partyObtains, deletePartyObtain } = usePartyObtains();
  const { mdGridTranspose, toggleMdGridTranspose } = useAppSettings();
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [unregisteredNames, setUnregisteredNames] = useState<string[]>([]);
  const [unregisteredMvpNames, setUnregisteredMvpNames] = useState<string[]>(
    [],
  );
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [bulkRecordOpen, setBulkRecordOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeDungeons = (dungeons ?? []).filter((d) => !d.archived);
  const activeCharacters = (characters ?? []).filter((c) => !c.archived);
  const allRuns = runs ?? [];
  // Search filters only the row axis (whichever entity is currently listed
  // top-to-bottom) — columns and cycle totals still cover every MD/character
  // so exclusion counts and the achievement tally never look wrong just
  // because a search is active.
  const searchQuery = search.trim().toLowerCase();
  const searchedDungeons = searchQuery
    ? activeDungeons.filter((d) => d.name.toLowerCase().includes(searchQuery))
    : activeDungeons;
  const searchedCharacters = searchQuery
    ? activeCharacters.filter((c) => c.name.toLowerCase().includes(searchQuery))
    : activeCharacters;

  useEffect(() => {
    if (!pendingRecordTarget) return;
    const dungeon = activeDungeons.find(
      (d) => d.id === pendingRecordTarget.dungeonId,
    );
    const character = activeCharacters.find(
      (c) => c.id === pendingRecordTarget.characterId,
    );
    if (dungeon && character) {
      if (!isMdExcluded(dungeon, character)) setActiveCell({ dungeon, character });
      onConsumeRecordTarget?.();
    } else if (activeDungeons.length > 0 && activeCharacters.length > 0) {
      // Data has finished loading (useMdDungeons/useCharacters resolve from
      // an empty-array placeholder to the real list asynchronously) and the
      // target still doesn't match anything — it's stale, drop it. If the
      // lists are still empty, this is the loading placeholder and the
      // effect will re-run once the real data arrives.
      onConsumeRecordTarget?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecordTarget, dungeons, characters]);

  if (activeDungeons.length === 0 || activeCharacters.length === 0) {
    return (
      <section className="panel">
        <h2>MD進捗</h2>
        <p className="empty">
          {activeCharacters.length === 0
            ? "設定タブでキャラクターを登録すると、ここにグリッドが表示されます。"
            : "MDマスタタブからMDを登録すると、ここにグリッドが表示されます。"}
        </p>
      </section>
    );
  }

  async function handleCellClick(dungeon: MdDungeon, character: Character) {
    if (isMdExcluded(dungeon, character)) return;

    const status = getCtStatus(
      character.id,
      dungeon.id,
      dungeon.ctType,
      allRuns,
      undefined,
      dungeon.attemptsPerCycle ?? 1,
    );
    const latest = getLatestRun(allRuns, character.id, dungeon.id);
    const isDone = latest !== null && !status.available;

    if (isDone && latest) {
      // Items obtained via a PT分配 (MD進捗のドロップ記録でPT人数2+) were
      // routed through addPartyObtain, not addStock — undo those via
      // deletePartyObtain so both the inventory delta and the now-orphaned
      // PT在庫一覧 entry are cleaned up together, not just the stock number.
      const linkedPartyObtains = (partyObtains ?? []).filter(
        (e) => e.sourceRunId === latest.id,
      );
      const coveredItemNames = new Set(
        linkedPartyObtains.map((e) => e.itemName),
      );
      for (const entry of linkedPartyObtains) {
        await deletePartyObtain(entry.id);
      }
      if (latest.items) {
        for (const [name, qty] of Object.entries(latest.items)) {
          if (coveredItemNames.has(name)) continue;
          await removeStock(name, qty);
        }
      }
      await deleteRun(latest.id);
      return;
    }
    setActiveCell({ dungeon, character });
  }

  function handleCellContextMenu(
    e: MouseEvent,
    dungeon: MdDungeon,
    character: Character,
  ) {
    e.preventDefault();
    if (character.mdExcluded || isLevelExcluded(dungeon, character)) return;
    toggleExclusion(dungeon.id, character.id);
  }

  function handleHeaderContextMenu(e: MouseEvent, character: Character) {
    e.preventDefault();
    updateCharacter(character.id, { mdExcluded: !character.mdExcluded });
  }

  function onDragStartDungeon(e: DragEvent, id: string) {
    e.dataTransfer.setData("dungeonId", id);
  }
  function onDropDungeon(e: DragEvent, dropId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("dungeonId");
    if (id) reorderDungeon(id, dropId);
  }
  function onDragStartCharacter(e: DragEvent, id: string) {
    e.dataTransfer.setData("characterId", id);
  }
  function onDropCharacter(e: DragEvent, dropId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("characterId");
    if (id) reorderCharacter(id, dropId);
  }

  function eligibleCharactersFor(dungeon: MdDungeon): Character[] {
    return activeCharacters.filter((c) => !isMdExcluded(dungeon, c));
  }

  function computeDungeonStats(dungeon: MdDungeon): DungeonStats {
    const dungeonRuns = allRuns.filter((r) => r.dungeonId === dungeon.id);
    const mobKillCounts = getAllMvpMobNames(dungeon).map((mob) => ({
      mob,
      count: dungeonRuns.filter((r) => r.mvpDefeats[mob]).length,
    }));
    const bestRecord = pickBestMdRecord(dungeonRuns, dungeon);

    const eligible = eligibleCharactersFor(dungeon);
    const doneCount = eligible.filter((character) => {
      const status = getCtStatus(
        character.id,
        dungeon.id,
        dungeon.ctType,
        allRuns,
        undefined,
        dungeon.attemptsPerCycle ?? 1,
      );
      return (
        getLatestRun(allRuns, character.id, dungeon.id) && !status.available
      );
    }).length;

    return { mobKillCounts, bestRecord, eligibleCount: eligible.length, doneCount };
  }

  const dungeonStatsById = new Map(
    activeDungeons.map((d) => [d.id, computeDungeonStats(d)]),
  );

  let totalDone = 0;
  let totalMax = 0;
  for (const stats of dungeonStatsById.values()) {
    totalDone += stats.doneCount;
    totalMax += stats.eligibleCount;
  }

  function DungeonHeader({ dungeon }: { dungeon: MdDungeon }) {
    const stats = dungeonStatsById.get(dungeon.id);
    if (!stats) return null;
    const recordLabel = dungeonRecordLabel(dungeon, stats.bestRecord);
    return (
      <>
        {dungeon.name}
        <span className="entity-list-sub">
          <span className={getCtBadgeClass(dungeon.ctType)}>
            {getCtLabel(dungeon.ctType)}
          </span>
          {` / 達成 ${stats.doneCount}/${stats.eligibleCount}`}
          {dungeon.requiredLevel !== undefined &&
            ` / 必要Lv${dungeon.requiredLevel}`}
          {dungeon.accountCharacterLimit !== undefined &&
            ` / アカウント上限${dungeon.accountCharacterLimit}人`}
          {dungeon.attemptsPerCycle !== undefined &&
            dungeon.attemptsPerCycle > 1 &&
            ` / 挑戦${dungeon.attemptsPerCycle}回`}
          {stats.mobKillCounts.length > 0 && (
            <>
              {" / "}
              <span
                title={stats.mobKillCounts
                  .map((m) => `${m.mob}:${m.count}体`)
                  .join(" ")}
                draggable={false}
              >
                MVP討伐{" "}
                {stats.mobKillCounts.reduce((sum, m) => sum + m.count, 0)}体
                （{stats.mobKillCounts.length}種、ホバーで内訳）
              </span>
            </>
          )}
          {recordLabel && ` / ${recordLabel}`}
        </span>
      </>
    );
  }

  function CharacterHeader({ character }: { character: Character }) {
    return (
      <>
        {character.name}
        {character.mdExcluded && <span> (対象外)</span>}
        <span className="entity-list-sub">{characterSubLabel(character)}</span>
      </>
    );
  }

  function GridCell({
    dungeon,
    character,
  }: {
    dungeon: MdDungeon;
    character: Character;
  }) {
    const isExcluded = isMdExcluded(dungeon, character);
    if (isExcluded) {
      const levelExcluded = isLevelExcluded(dungeon, character);
      return (
        <td
          className="md-cell-excluded"
          title={
            levelExcluded
              ? `必要Lv${dungeon.requiredLevel}（現在Lv${character.level ?? "未設定"}）`
              : undefined
          }
          draggable={false}
          onContextMenu={(e) => handleCellContextMenu(e, dungeon, character)}
        >
          {levelExcluded ? `Lv${dungeon.requiredLevel}未満` : "対象外"}
        </td>
      );
    }
    const status = getCtStatus(
      character.id,
      dungeon.id,
      dungeon.ctType,
      allRuns,
      undefined,
      dungeon.attemptsPerCycle ?? 1,
    );
    const latest = getLatestRun(allRuns, character.id, dungeon.id);
    const isDone = latest !== null && !status.available;
    const limit = dungeon.accountCharacterLimit;
    const accountRunCount =
      !isDone && limit !== undefined
        ? getAccountRunCount(activeCharacters, allRuns, dungeon, character)
        : 0;
    const isAccountLimitReached =
      !isDone &&
      limit !== undefined &&
      !!character.account &&
      accountRunCount >= limit;
    const attemptsPerCycle = dungeon.attemptsPerCycle ?? 1;
    const attemptInProgress =
      !isDone &&
      !isAccountLimitReached &&
      attemptsPerCycle > 1 &&
      status.remainingAttempts < attemptsPerCycle;
    return (
      <td
        className={
          isDone
            ? "md-cell-done"
            : isAccountLimitReached
              ? "md-cell-account-limit"
              : "md-cell-available"
        }
        title={
          isAccountLimitReached
            ? `アカウント「${character.account}」は上限${limit}人に達しています（${accountRunCount}人が周回済み）`
            : attemptInProgress
              ? `1サイクルに${attemptsPerCycle}回挑戦可能（残り${status.remainingAttempts}回）`
              : undefined
        }
        draggable={false}
        onClick={() => handleCellClick(dungeon, character)}
        onContextMenu={(e) => handleCellContextMenu(e, dungeon, character)}
      >
        {isDone && status.nextAvailableAt
          ? formatRemaining(status.nextAvailableAt)
          : isAccountLimitReached
            ? "上限"
            : attemptInProgress
              ? `残り${status.remainingAttempts}回`
              : "—"}
      </td>
    );
  }

  return (
    <section className="panel fill-panel">
      <h2>MD進捗</h2>
      <p className="hint">
        セルをクリックで記録、記録済み（CT中）のセルを再クリックで取り消せます。行けないキャラのセルは右クリックで「対象外」に切り替えられます。
        そのMD自体に行けないキャラは、列見出し（キャラ名）を右クリックすると全MDでまとめて「対象外」にできます。
        MDマスタで必要Lvを設定すると、達していないキャラのセルは自動で「Lv◯未満」の対象外になります（Lvを上げれば自動で解除されます）。
        アカウントあたりの挑戦人数に上限があるMDでは、同じアカウントの他キャラが既に上限まで周回済みのセルに「上限」と表示されます（記録自体はブロックされません）。
        MDマスタで1サイクルの挑戦回数を2回以上に設定すると、使い切るまで「残りN回」と表示されクリックで追加記録できます。
        見出しはドラッグでも並び替えられます（MDマスタ・設定タブの順序と共通です）。🔄縦横切替で行と列を入れ替えられます。
      </p>
      <div className="form-actions" style={{ marginBottom: "0.5rem" }}>
        <p style={{ margin: 0, flex: 1 }}>
          <strong>
            今サイクルの達成: {totalDone}/{totalMax}
          </strong>
        </p>
        <button type="button" onClick={toggleMdGridTranspose}>
          🔄 縦横切替
        </button>
        <button type="button" onClick={() => setManualEntryOpen(true)}>
          手動入力する（過去日・個別記録）
        </button>
        <button type="button" onClick={() => setBulkRecordOpen(true)}>
          複数キャラ一括記録
        </button>
      </div>
      <input
        placeholder={mdGridTranspose ? "キャラ名で検索" : "MD名で検索"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginBottom: "0.5rem" }}
      />
      <div className="md-grid-scroll">
        <table className="md-grid">
          {!mdGridTranspose ? (
            <>
              <thead>
                <tr>
                  <th className="md-grid-corner">MD</th>
                  {activeCharacters.map((c) => (
                    <th
                      key={c.id}
                      className={
                        c.mdExcluded
                          ? "md-grid-col-head md-header-excluded"
                          : "md-grid-col-head"
                      }
                      draggable
                      onDragStart={(e) => onDragStartCharacter(e, c.id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropCharacter(e, c.id)}
                      onContextMenu={(e) => handleHeaderContextMenu(e, c)}
                    >
                      <CharacterHeader character={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchedDungeons.map((dungeon) => (
                  <tr
                    key={dungeon.id}
                    draggable
                    onDragStart={(e) => onDragStartDungeon(e, dungeon.id)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDropDungeon(e, dungeon.id)}
                  >
                    <th className="md-grid-row-head">
                      <DungeonHeader dungeon={dungeon} />
                    </th>
                    {activeCharacters.map((character) => (
                      <GridCell
                        key={character.id}
                        dungeon={dungeon}
                        character={character}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th className="md-grid-corner">キャラ</th>
                  {activeDungeons.map((dungeon) => (
                    <th
                      key={dungeon.id}
                      className="md-grid-col-head"
                      draggable
                      onDragStart={(e) => onDragStartDungeon(e, dungeon.id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropDungeon(e, dungeon.id)}
                    >
                      <DungeonHeader dungeon={dungeon} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchedCharacters.map((character) => (
                  <tr
                    key={character.id}
                    draggable
                    onDragStart={(e) => onDragStartCharacter(e, character.id)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDropCharacter(e, character.id)}
                  >
                    <th
                      className={
                        character.mdExcluded
                          ? "md-grid-row-head md-header-excluded"
                          : "md-grid-row-head"
                      }
                      onContextMenu={(e) =>
                        handleHeaderContextMenu(e, character)
                      }
                    >
                      <CharacterHeader character={character} />
                    </th>
                    {activeDungeons.map((dungeon) => (
                      <GridCell
                        key={dungeon.id}
                        dungeon={dungeon}
                        character={character}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>

      <Modal open={activeCell !== null} onClose={() => setActiveCell(null)}>
        {activeCell && (
          <MdDropPanel
            dungeon={activeCell.dungeon}
            character={activeCell.character}
            onClose={() => setActiveCell(null)}
            onUnregisteredItems={setUnregisteredNames}
            onUnregisteredMvps={setUnregisteredMvpNames}
          />
        )}
      </Modal>
      <Modal open={manualEntryOpen} onClose={() => setManualEntryOpen(false)}>
        {manualEntryOpen && (
          <MdRunForm
            editingRun={null}
            onDone={() => setManualEntryOpen(false)}
            onUnregisteredItems={setUnregisteredNames}
          />
        )}
      </Modal>
      <Modal open={bulkRecordOpen} onClose={() => setBulkRecordOpen(false)}>
        {bulkRecordOpen && (
          <MdBulkRecordPanel
            onClose={() => setBulkRecordOpen(false)}
            onUnregisteredItems={setUnregisteredNames}
            onUnregisteredMvps={setUnregisteredMvpNames}
          />
        )}
      </Modal>
      <UnregisteredItemPrompt
        itemNames={unregisteredNames}
        onDone={() => setUnregisteredNames([])}
      />
      <UnregisteredMvpPrompt
        mvpNames={unregisteredMvpNames}
        onDone={() => setUnregisteredMvpNames([])}
      />
    </section>
  );
}
