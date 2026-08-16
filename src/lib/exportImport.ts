import { db, CURRENT_SCHEMA_VERSION } from "../db/db";
import type {
  Character,
  MdDungeon,
  MdRun,
  MvpMaster,
  MvpKill,
  FinanceTransaction,
  ItemPrice,
  InventoryItem,
  WishlistItem,
  AppConfig,
  DebtEntry,
  CashFlowPlanEntry,
  Goal,
} from "../db/types";

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: number;
  data: {
    characters: Character[];
    mdDungeons: MdDungeon[];
    mdRuns: MdRun[];
    mvpMaster: MvpMaster[];
    mvpKills: MvpKill[];
    financeTransactions: FinanceTransaction[];
    itemPrices: ItemPrice[];
    inventoryItems: InventoryItem[];
    wishlistItems: WishlistItem[];
    appConfig: AppConfig[];
    debts: DebtEntry[];
    cashFlowPlans: CashFlowPlanEntry[];
    goals: Goal[];
  };
}

export async function exportAllData(): Promise<ExportPayload> {
  return db.transaction("r", db.tables, async () => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: {
      characters: await db.characters.toArray(),
      mdDungeons: await db.mdDungeons.toArray(),
      mdRuns: await db.mdRuns.toArray(),
      mvpMaster: await db.mvpMaster.toArray(),
      mvpKills: await db.mvpKills.toArray(),
      financeTransactions: await db.financeTransactions.toArray(),
      itemPrices: await db.itemPrices.toArray(),
      inventoryItems: await db.inventoryItems.toArray(),
      wishlistItems: await db.wishlistItems.toArray(),
      appConfig: await db.appConfig.toArray(),
      debts: await db.debts.toArray(),
      cashFlowPlans: await db.cashFlowPlans.toArray(),
      goals: await db.goals.toArray(),
    },
  }));
}

export function downloadExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(payload.exportedAt)
    .toISOString()
    .replace(/[-:]/g, "")
    .slice(0, 13);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ro-md-management-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Migration steps run in order when an imported payload's schemaVersion is
// older than CURRENT_SCHEMA_VERSION. Key = version migrated FROM. Each step
// reshapes toward the next version only, so intermediate shapes legitimately
// don't match the current types — hence the loose `any` typing here; the
// result is only cast back to ExportPayload once the chain completes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const migrations: Record<number, (p: any) => any> = {
  1: (p) => ({
    ...p,
    data: {
      ...p.data,
      mdRuns: p.data.mdRuns.map((run: Record<string, unknown>) => ({
        ...run,
        bossDefeated: (run.bossDefeated as boolean | undefined) ?? true,
      })),
      itemPrices: [],
      inventoryItems: [],
      wishlistItems: [],
    },
  }),
  2: (p) => ({
    ...p,
    data: {
      ...p.data,
      mdDungeons: p.data.mdDungeons.map((dungeon: Record<string, unknown>) => {
        const { ctHours: _ctHours, ...rest } = dungeon;
        return {
          ...rest,
          ctType: (dungeon.ctType as MdDungeon["ctType"]) ?? "daily",
          items: (dungeon.items as Record<string, number>) ?? {},
        };
      }),
    },
  }),
  3: (p) => ({
    ...p,
    data: {
      ...p.data,
      mdDungeons: p.data.mdDungeons.map((dungeon: Record<string, unknown>) => ({
        ...dungeon,
        mvpMobs: (dungeon.mvpMobs as string[] | undefined) ?? [],
      })),
      mdRuns: p.data.mdRuns.map((run: Record<string, unknown>) => {
        const { bossDefeated, ...rest } = run;
        return {
          ...rest,
          mvpDefeats: (run.mvpDefeats as
            Record<string, boolean> | undefined) ?? {
            ボス: (bossDefeated as boolean | undefined) ?? true,
          },
        };
      }),
      appConfig: p.data.appConfig ?? [],
    },
  }),
  4: (p) => ({
    ...p,
    data: {
      ...p.data,
      debts: p.data.debts ?? [],
    },
  }),
  5: (p) => ({
    ...p,
    data: {
      ...p.data,
      cashFlowPlans: p.data.cashFlowPlans ?? [],
    },
  }),
  6: (p) => ({
    ...p,
    data: {
      ...p.data,
      goals: p.data.goals ?? [],
    },
  }),
};

function migrateExport(payload: ExportPayload): ExportPayload {
  let p: ExportPayload = payload;
  for (let v = p.schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (step) p = step(p);
  }
  return { ...p, schemaVersion: CURRENT_SCHEMA_VERSION };
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === "object" && v !== null)
  );
}

/** Hand-rolled shape check for the one boundary where untrusted data enters the app: an imported JSON file. */
function validateExportPayload(raw: unknown): ExportPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(
      "インポートファイルの形式が不正です（JSONオブジェクトではありません）。",
    );
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "number") {
    throw new Error("インポートファイルにschemaVersionがありません。");
  }
  if (typeof obj.data !== "object" || obj.data === null) {
    throw new Error("インポートファイルにdataがありません。");
  }
  const data = obj.data as Record<string, unknown>;
  const requiredTables = [
    "characters",
    "mdDungeons",
    "mdRuns",
    "mvpMaster",
    "mvpKills",
    "financeTransactions",
  ] as const;
  const optionalTables = [
    "itemPrices",
    "inventoryItems",
    "wishlistItems",
    "appConfig",
    "debts",
    "cashFlowPlans",
    "goals",
  ] as const;
  for (const table of optionalTables) {
    if (data[table] === undefined) data[table] = [];
  }
  for (const table of [...requiredTables, ...optionalTables]) {
    if (!isArrayOfObjects(data[table])) {
      throw new Error(`インポートファイルの${table}が配列ではありません。`);
    }
  }
  return {
    schemaVersion: obj.schemaVersion,
    exportedAt:
      typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
    data: data as unknown as ExportPayload["data"],
  };
}

/** Wipes every table — used for a full factory reset (paired with seedInitialData() to restore the starter master data). */
export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

export type ImportMode = "replace" | "merge";

export async function importAllData(
  raw: unknown,
  mode: ImportMode,
): Promise<void> {
  const payload = validateExportPayload(raw);
  const migrated = migrateExport(payload);

  await db.transaction("rw", db.tables, async () => {
    if (mode === "replace") {
      await Promise.all(db.tables.map((t) => t.clear()));
    }
    await db.characters.bulkPut(migrated.data.characters);
    await db.mdDungeons.bulkPut(migrated.data.mdDungeons);
    await db.mdRuns.bulkPut(migrated.data.mdRuns);
    await db.mvpMaster.bulkPut(migrated.data.mvpMaster);
    await db.mvpKills.bulkPut(migrated.data.mvpKills);
    await db.financeTransactions.bulkPut(migrated.data.financeTransactions);
    await db.itemPrices.bulkPut(migrated.data.itemPrices);
    await db.inventoryItems.bulkPut(migrated.data.inventoryItems);
    await db.wishlistItems.bulkPut(migrated.data.wishlistItems);
    await db.appConfig.bulkPut(migrated.data.appConfig);
    await db.debts.bulkPut(migrated.data.debts);
    await db.cashFlowPlans.bulkPut(migrated.data.cashFlowPlans);
    await db.goals.bulkPut(migrated.data.goals);
  });
}
