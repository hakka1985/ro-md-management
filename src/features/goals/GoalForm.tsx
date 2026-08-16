import { useState, type FormEvent } from "react";
import { useGoals } from "./useGoals";
import { useWishlist } from "../wishlist/useWishlist";
import { parseZeny } from "../../lib/zeny";
import type { GoalTier } from "../../db/types";

const TIER_OPTIONS: { key: GoalTier; label: string }[] = [
  { key: "short", label: "短期" },
  { key: "mid", label: "中期" },
  { key: "long", label: "長期" },
];

export function GoalForm() {
  const { addGoal } = useGoals();
  const { items: wishlistItems } = useWishlist();
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<GoalTier>("short");
  const [targetAmount, setTargetAmount] = useState("");
  const [wishlistItemId, setWishlistItemId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [memo, setMemo] = useState("");

  const pendingWishlist = wishlistItems.filter((i) => !i.obtained);

  function handleWishlistLink(id: string) {
    setWishlistItemId(id);
    const item = pendingWishlist.find((i) => i.id === id);
    if (item) {
      if (!title.trim()) setTitle(item.itemName);
      setTargetAmount(String(item.quantity * item.unitCost));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseZeny(targetAmount);
    if (!title.trim() || amount <= 0) return;
    await addGoal({
      title: title.trim(),
      tier,
      targetAmount: amount,
      wishlistItemId: wishlistItemId || undefined,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      memo: memo.trim(),
    });
    setTitle("");
    setTargetAmount("");
    setWishlistItemId("");
    setDeadline("");
    setMemo("");
  }

  return (
    <form className="panel stacked-form" onSubmit={handleSubmit}>
      <h2>目標を追加</h2>

      <label>
        欲しいものリストと連動（任意）
        <select
          value={wishlistItemId}
          onChange={(e) => handleWishlistLink(e.target.value)}
        >
          <option value="">連動しない</option>
          {pendingWishlist.map((i) => (
            <option key={i.id} value={i.id}>
              {i.itemName}（{(i.quantity * i.unitCost).toLocaleString()} z）
            </option>
          ))}
        </select>
      </label>

      <label>
        目標タイトル
        <input
          placeholder="例: 万能薬を買う"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label>
        区分
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as GoalTier)}
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        目標金額（合計資産がこの額に届いたら達成）
        <input
          placeholder="例: 10M, 1G"
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
        <button type="submit">追加する</button>
      </div>
    </form>
  );
}
