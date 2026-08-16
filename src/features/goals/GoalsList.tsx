import { useState, type DragEvent, type FormEvent } from "react";
import { useGoals } from "./useGoals";
import { useWishlist } from "../wishlist/useWishlist";
import {
  useTransactions,
  useInventory,
  useItemPrices,
  useDebts,
} from "../finance/useFinance";
import { useCharacters } from "../characters/useCharacters";
import { useAppSettings } from "../settings/useAppSettings";
import { getCurrentTotalAssets } from "../../lib/financeCalc";
import { formatZ, parseZeny } from "../../lib/zeny";
import { formatDate } from "../../lib/date";
import { ReorderButtons } from "../../components/ReorderButtons";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import type { Goal, GoalTier } from "../../db/types";

const TIER_SECTIONS: { key: GoalTier; label: string }[] = [
  { key: "short", label: "🎯 短期目標" },
  { key: "mid", label: "🚩 中期目標" },
  { key: "long", label: "🏔️ 長期目標" },
];

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

interface GoalEditFormProps {
  goal: Goal;
  onSave: (patch: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onClose: () => void;
}

function GoalEditForm({ goal, onSave, onClose }: GoalEditFormProps) {
  const [title, setTitle] = useState(goal.title);
  const [tier, setTier] = useState<GoalTier>(goal.tier);
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount));
  const [deadline, setDeadline] = useState(
    goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : "",
  );
  const [memo, setMemo] = useState(goal.memo ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseZeny(targetAmount);
    if (!title.trim() || amount <= 0) return;
    onSave({
      title: title.trim(),
      tier,
      targetAmount: amount,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      memo: memo.trim() || undefined,
    });
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit}>
      <h2>目標を編集</h2>
      <label>
        目標タイトル
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label>
        区分
        <select value={tier} onChange={(e) => setTier(e.target.value as GoalTier)}>
          <option value="short">短期</option>
          <option value="mid">中期</option>
          <option value="long">長期</option>
        </select>
      </label>
      <label>
        目標金額
        <input
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          required
        />
      </label>
      <label>
        期限（任意）
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </label>
      <label>
        メモ（任意）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className="form-actions">
        <button type="submit">保存</button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function GoalsList() {
  const { goals, setAchieved, updateGoal, deleteGoal, restoreGoal, reorderGoal } =
    useGoals();
  const { items: wishlistItems } = useWishlist();
  const { showUndo } = useToast();
  const { transactions } = useTransactions();
  const { inventory } = useInventory();
  const { itemPrices } = useItemPrices();
  const { characters } = useCharacters();
  const { debts } = useDebts();
  const { useNRate, baselineDate, baselineAmount } = useAppSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingGoal = goals.find((g) => g.id === editingId) ?? null;

  const totalAssets = getCurrentTotalAssets({
    transactions,
    inventory,
    itemPrices,
    characters,
    debts,
    useNRate,
    baselineDate,
    baselineAmount,
  });

  const wishlistById = new Map(wishlistItems.map((i) => [i.id, i]));

  return (
    <div className="stacked-form">
      <p className="hint">
        いずれの目標も「合計資産（全部売れたら）」が目標金額に届いたかどうかで進捗を計算します。現在の合計資産:{" "}
        <strong>{formatZ(totalAssets)}</strong>
      </p>
      {TIER_SECTIONS.map((section) => {
        const tierGoals = goals
          .filter((g) => g.tier === section.key)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section className="panel" key={section.key}>
            <h2>{section.label}</h2>
            {tierGoals.length === 0 ? (
              <p className="empty">目標はまだありません</p>
            ) : (
              <ul className="entity-list">
                {tierGoals.map((goal, index) => {
                  const linkedItem = goal.wishlistItemId
                    ? wishlistById.get(goal.wishlistItemId)
                    : undefined;
                  const progress = Math.min(
                    100,
                    goal.targetAmount > 0
                      ? (totalAssets / goal.targetAmount) * 100
                      : 0,
                  );
                  const reached = progress >= 100;
                  return (
                    <li
                      key={goal.id}
                      className={goal.achieved ? "archived" : ""}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("goalId", goal.id)
                      }
                      onDragOver={onDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragId = e.dataTransfer.getData("goalId");
                        if (dragId) reorderGoal(dragId, goal.id);
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span className="entity-list-main">
                          {goal.title}
                          {linkedItem && (
                            <span className="hint">
                              {" "}
                              （欲しい物: {linkedItem.itemName}
                              {linkedItem.obtained && " ・入手済み"}）
                            </span>
                          )}
                        </span>
                        <div
                          className="progress-bar-track"
                          title={`${totalAssets.toLocaleString()} z / ${goal.targetAmount.toLocaleString()} z`}
                        >
                          <div
                            className={
                              reached
                                ? "progress-bar-fill progress-bar-fill-complete goal-complete-pulse"
                                : "progress-bar-fill"
                            }
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="hint">
                          {formatZ(totalAssets)} / {formatZ(goal.targetAmount)}
                          {reached && !goal.achieved && " ・🎉 目標金額に到達しました！"}
                          {goal.deadline &&
                            ` ・期限: ${formatDate(goal.deadline)}`}
                          {goal.memo && ` ・${goal.memo}`}
                        </span>
                      </div>
                      <span className="entity-list-actions">
                        <ReorderButtons
                          onMoveUp={() => {
                            if (index > 0)
                              reorderGoal(goal.id, tierGoals[index - 1].id);
                          }}
                          onMoveDown={() => {
                            if (index < tierGoals.length - 1)
                              reorderGoal(goal.id, tierGoals[index + 1].id);
                          }}
                          canMoveUp={index > 0}
                          canMoveDown={index < tierGoals.length - 1}
                        />
                        <button
                          type="button"
                          onClick={() => setAchieved(goal.id, !goal.achieved)}
                        >
                          {goal.achieved ? "未達成に戻す" : "達成済みにする"}
                        </button>
                        <button type="button" onClick={() => setEditingId(goal.id)}>
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `「${goal.title}」を削除しますか？`,
                              )
                            ) {
                              const record: Goal = goal;
                              deleteGoal(goal.id);
                              showUndo(`「${goal.title}」を削除しました`, () =>
                                restoreGoal(record),
                              );
                            }
                          }}
                        >
                          削除
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <Modal open={editingGoal !== null} onClose={() => setEditingId(null)}>
        {editingGoal && (
          <GoalEditForm
            goal={editingGoal}
            onSave={(patch) => {
              updateGoal(editingGoal.id, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </div>
  );
}
