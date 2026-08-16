import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { newId } from "../../lib/id";
import type { CashFlowPlanEntry, CashFlowPlanKind } from "../../db/types";

export function useCashFlowPlan() {
  const entries = useLiveQuery(
    async () => {
      const all = await db.cashFlowPlans.toArray();
      return all.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    },
    [],
    [] as CashFlowPlanEntry[],
  );

  async function addEntry(input: {
    kind: CashFlowPlanKind;
    itemName: string;
    quantity: number;
    unitPrice: number;
    memo?: string;
  }) {
    const maxPriority = (entries ?? []).reduce(
      (max, e) => Math.max(max, e.priority ?? 0),
      -1,
    );
    await db.cashFlowPlans.add({
      id: newId(),
      kind: input.kind,
      itemName: input.itemName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      priority: maxPriority + 1,
      memo: input.memo || undefined,
      createdAt: Date.now(),
    });
  }

  async function toggleDone(id: string, done: boolean) {
    await db.cashFlowPlans.update(id, { done });
  }

  async function deleteEntry(id: string) {
    await db.cashFlowPlans.delete(id);
  }

  /** Drag-reorders entries by priority — same splice-and-renumber pattern as reorderDungeon/reorderItem. */
  async function reorderEntry(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const ordered = [...(entries ?? [])];
    const from = ordered.findIndex((e) => e.id === dragId);
    const to = ordered.findIndex((e) => e.id === dropId);
    if (from === -1 || to === -1) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await db.transaction("rw", db.cashFlowPlans, async () => {
      for (let i = 0; i < ordered.length; i++) {
        await db.cashFlowPlans.update(ordered[i].id, { priority: i });
      }
    });
  }

  return { entries, addEntry, toggleDone, deleteEntry, reorderEntry };
}
