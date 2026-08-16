import Dexie, { type Table } from "dexie";
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
} from "./types";

// Bump alongside export payload migrations, see lib/exportImport.ts
export const CURRENT_SCHEMA_VERSION = 7;

export class RoDatabase extends Dexie {
  characters!: Table<Character, string>;
  mdDungeons!: Table<MdDungeon, string>;
  mdRuns!: Table<MdRun, string>;
  mvpMaster!: Table<MvpMaster, string>;
  mvpKills!: Table<MvpKill, string>;
  financeTransactions!: Table<FinanceTransaction, string>;
  itemPrices!: Table<ItemPrice, string>;
  inventoryItems!: Table<InventoryItem, string>;
  wishlistItems!: Table<WishlistItem, string>;
  appConfig!: Table<AppConfig, string>;
  debts!: Table<DebtEntry, string>;
  cashFlowPlans!: Table<CashFlowPlanEntry, string>;
  goals!: Table<Goal, string>;

  constructor() {
    super("ro-md-management");
    this.version(1).stores({
      characters: "id, name, server, archived",
      mdDungeons: "id, name, category, archived",
      mdRuns:
        "id, characterId, dungeonId, completedAt, [dungeonId+characterId]",
      mvpMaster: "id, name, archived",
      mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
      financeTransactions: "id, type, date, characterId, source, sourceRefId",
    });

    // v2: MD run boss-kill tracking + clear time, item price/inventory,
    // and wishlist tables. Existing mdRuns are backfilled with
    // bossDefeated: true (pre-v2 runs had no way to record a miss).
    this.version(2)
      .stores({
        characters: "id, name, server, archived",
        mdDungeons: "id, name, category, archived",
        mdRuns:
          "id, characterId, dungeonId, completedAt, bossDefeated, [dungeonId+characterId]",
        mvpMaster: "id, name, archived",
        mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
        financeTransactions: "id, type, date, characterId, source, sourceRefId",
        itemPrices: "id, itemName, archived",
        inventoryItems: "id, itemName",
        wishlistItems: "id, itemName, obtained, createdAt",
      })
      .upgrade((tx) =>
        tx
          .table("mdRuns")
          .toCollection()
          .modify((run) => {
            if (run.bossDefeated === undefined) run.bossDefeated = true;
          }),
      );

    // v3: replace the rolling-hours CT model (ctHours) with the game's
    // actual fixed-reset-time model (ctType), and add per-run item drops.
    // Existing dungeons had no ctType, so they're backfilled as 'daily'
    // (the most common/safe default) — the user can correct via
    // MdDungeonManager since ctHours carried no reliable mapping to a
    // specific reset schedule.
    this.version(3)
      .stores({
        characters: "id, name, server, archived",
        mdDungeons: "id, name, category, archived",
        mdRuns:
          "id, characterId, dungeonId, completedAt, bossDefeated, [dungeonId+characterId]",
        mvpMaster: "id, name, archived",
        mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
        financeTransactions: "id, type, date, characterId, source, sourceRefId",
        itemPrices: "id, itemName, archived",
        inventoryItems: "id, itemName",
        wishlistItems: "id, itemName, obtained, createdAt",
      })
      .upgrade((tx) =>
        tx
          .table("mdDungeons")
          .toCollection()
          .modify((dungeon) => {
            if (dungeon.ctType === undefined) dungeon.ctType = "daily";
            if (dungeon.items === undefined) dungeon.items = {};
            delete dungeon.ctHours;
          }),
      );

    // v4: MD dungeons can now name individual MVP mobs, and runs record
    // per-mob defeat instead of a single boolean. Existing mdRuns had no
    // mob names to attach to, so their bossDefeated flag is preserved
    // under a generic "ボス" key rather than discarded.
    this.version(4)
      .stores({
        characters: "id, name, server, archived",
        mdDungeons: "id, name, category, archived",
        mdRuns:
          "id, characterId, dungeonId, completedAt, [dungeonId+characterId]",
        mvpMaster: "id, name, archived",
        mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
        financeTransactions: "id, type, date, characterId, source, sourceRefId",
        itemPrices: "id, itemName, archived",
        inventoryItems: "id, itemName",
        wishlistItems: "id, itemName, obtained, createdAt",
        appConfig: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("mdDungeons")
          .toCollection()
          .modify((dungeon) => {
            if (dungeon.mvpMobs === undefined) dungeon.mvpMobs = [];
          });
        await tx
          .table("mdRuns")
          .toCollection()
          .modify((run) => {
            if (run.mvpDefeats === undefined) {
              run.mvpDefeats = { ボス: run.bossDefeated ?? true };
              delete run.bossDefeated;
            }
          });
      });

    // v5: adds a debts table for tracking zeny borrowed from/lent to other
    // players — kept separate from financeTransactions so it never counts
    // as realized income/expense, only as a liability/asset offset in the
    // dashboard's total assets figure.
    this.version(5).stores({
      characters: "id, name, server, archived",
      mdDungeons: "id, name, category, archived",
      mdRuns:
        "id, characterId, dungeonId, completedAt, [dungeonId+characterId]",
      mvpMaster: "id, name, archived",
      mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
      financeTransactions: "id, type, date, characterId, source, sourceRefId",
      itemPrices: "id, itemName, archived",
      inventoryItems: "id, itemName",
      wishlistItems: "id, itemName, obtained, createdAt",
      appConfig: "key",
      debts: "id, direction, date",
    });

    // v6: adds a cashFlowPlans table for 資金計画 (planned future sell/buy
    // entries with a drag-reorderable priority) — kept separate from
    // financeTransactions since these haven't happened yet.
    this.version(6).stores({
      characters: "id, name, server, archived",
      mdDungeons: "id, name, category, archived",
      mdRuns:
        "id, characterId, dungeonId, completedAt, [dungeonId+characterId]",
      mvpMaster: "id, name, archived",
      mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
      financeTransactions: "id, type, date, characterId, source, sourceRefId",
      itemPrices: "id, itemName, archived",
      inventoryItems: "id, itemName",
      wishlistItems: "id, itemName, obtained, createdAt",
      appConfig: "key",
      debts: "id, direction, date",
      cashFlowPlans: "id, priority",
    });

    // v7: adds a goals table for 短期/中期/長期 savings milestones (targeted
    // against 合計資産), optionally linked to a wishlist item as the reward.
    this.version(7).stores({
      characters: "id, name, server, archived",
      mdDungeons: "id, name, category, archived",
      mdRuns:
        "id, characterId, dungeonId, completedAt, [dungeonId+characterId]",
      mvpMaster: "id, name, archived",
      mvpKills: "id, mvpId, characterId, killedAt, cardDropped",
      financeTransactions: "id, type, date, characterId, source, sourceRefId",
      itemPrices: "id, itemName, archived",
      inventoryItems: "id, itemName",
      wishlistItems: "id, itemName, obtained, createdAt",
      appConfig: "key",
      debts: "id, direction, date",
      cashFlowPlans: "id, priority",
      goals: "id, tier, sortOrder",
    });
  }
}

export const db = new RoDatabase();
