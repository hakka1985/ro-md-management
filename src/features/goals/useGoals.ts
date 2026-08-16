import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { Goal, GoalTier } from "../../db/types";

export function useGoals() {
  const goals = useLiveQuery(
    async () => {
      const all = await db.goals.toArray();
      return all.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [],
    [] as Goal[],
  );

  async function addGoal(input: {
    title: string;
    tier: GoalTier;
    targetAmount: number;
    wishlistItemId?: string;
    deadline?: number;
    memo?: string;
  }) {
    const maxOrder = (goals ?? []).reduce(
      (max, g) => Math.max(max, g.sortOrder),
      -1,
    );
    await db.goals.add({
      id: newId(),
      title: input.title,
      tier: input.tier,
      targetAmount: input.targetAmount,
      wishlistItemId: input.wishlistItemId || undefined,
      deadline: input.deadline,
      achieved: false,
      memo: input.memo || undefined,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    });
  }

  async function setAchieved(id: string, achieved: boolean) {
    await db.goals.update(id, { achieved });
  }

  async function deleteGoal(id: string) {
    await db.goals.delete(id);
  }

  /** Re-inserts a previously-deleted goal as-is (same id) — powers the "元に戻す" undo toast. */
  async function restoreGoal(record: Goal) {
    await db.goals.add(record);
  }

  /**
   * Reorders within the same tier only — the UI shows each tier as its own
   * list, so sortOrder only needs to be consistent within a tier; it's
   * renumbered 0..N-1 for that tier alone, ignoring other tiers' values
   * (every read filters by tier first, so cross-tier gaps/overlaps don't
   * matter).
   */
  async function reorderGoal(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const all = [...(goals ?? [])];
    const dragged = all.find((g) => g.id === dragId);
    if (!dragged) return;
    const tierGoals = all.filter((g) => g.tier === dragged.tier);
    const from = tierGoals.findIndex((g) => g.id === dragId);
    const to = tierGoals.findIndex((g) => g.id === dropId);
    if (from === -1 || to === -1) return;
    const [moved] = tierGoals.splice(from, 1);
    tierGoals.splice(to, 0, moved);
    await db.transaction("rw", db.goals, async () => {
      for (let i = 0; i < tierGoals.length; i++) {
        await db.goals.update(tierGoals[i].id, { sortOrder: i });
      }
    });
  }

  return {
    goals,
    addGoal,
    setAchieved,
    deleteGoal,
    restoreGoal,
    reorderGoal,
  };
}
