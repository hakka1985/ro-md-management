import type {
  Character,
  DebtEntry,
  FinanceSource,
  FinanceTransaction,
  InventoryItem,
  ItemPrice,
  MdDungeon,
  MdRun,
} from "../db/types";
import { isNServerCharacter } from "./zeny";

/** Sum of income minus expense across all recorded transactions. */
export function getRealizedProfit(transactions: FinanceTransaction[]): number {
  return transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
}

/** Value of currently-unsold inventory, priced at each item's expected sell price. Unpriced items count as 0. */
export function getInventoryValue(
  inventory: InventoryItem[],
  prices: ItemPrice[],
): number {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  return inventory.reduce(
    (sum, item) => sum + item.quantity * (priceByName.get(item.itemName) ?? 0),
    0,
  );
}

/**
 * Average net income (income - expense) per week over the trailing window.
 * Returns null when there's no transaction history in that window — not enough data to estimate a pace.
 * Transactions flagged isEventIncome (one-off windfalls: event drops sold,
 * giveaway proceeds, etc.) are excluded so a temporary spike doesn't
 * overstate ongoing affordability.
 */
export function getWeeklyNetIncomeAverage(
  transactions: FinanceTransaction[],
  weeks = 4,
  now: number = Date.now(),
): number | null {
  const windowStart = now - weeks * 7 * 24 * 60 * 60 * 1000;
  const inWindow = transactions.filter(
    (t) => t.date >= windowStart && t.date <= now && !t.isEventIncome,
  );
  if (inWindow.length === 0) return null;
  return getRealizedProfit(inWindow) / weeks;
}

export interface MdEfficiency {
  dungeonId: string;
  runCount: number;
  totalValue: number;
  avgValue: number;
  /** null when no run for this dungeon has a recorded clear time — hourly rate can't be computed. */
  hourlyRate: number | null;
  /**
   * Coefficient of variation (population stdDev / avgValue) of per-run item
   * value — lower means a steady, predictable payout every run; higher means
   * a "gamble" MD where most runs are low value and occasional runs are a
   * huge outlier (rare card, etc.). Null when there are fewer than 2 runs or
   * avgValue is 0 (not enough data / nothing to divide by).
   */
  coefficientOfVariation: number | null;
  /** Sum of MdRun.estimatedCost (consumables spent) across these runs — 0 when nobody entered a cost. */
  totalCost: number;
  /** totalValue - totalCost — the actual take-home, not just the gross drop value. */
  netTotalValue: number;
  netAvgValue: number;
  /** Same as hourlyRate but net of estimatedCost — null under the same condition as hourlyRate. */
  netHourlyRate: number | null;
}

/**
 * Per-dungeon efficiency: run count, value of items obtained (not requiring
 * an actual sale yet), and z/hour for the subset of runs that have a
 * recorded clear time (clearTimeSeconds is optional per run).
 */
export function getMdEfficiency(
  runs: MdRun[],
  prices: ItemPrice[],
): MdEfficiency[] {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  const byDungeon = new Map<
    string,
    {
      runCount: number;
      totalValue: number;
      totalCost: number;
      timedValue: number;
      timedCost: number;
      timedSeconds: number;
      runValues: number[];
    }
  >();

  for (const run of runs) {
    const entry = byDungeon.get(run.dungeonId) ?? {
      runCount: 0,
      totalValue: 0,
      totalCost: 0,
      timedValue: 0,
      timedCost: 0,
      timedSeconds: 0,
      runValues: [],
    };
    entry.runCount += 1;
    let runValue = 0;
    if (run.items) {
      for (const [name, qty] of Object.entries(run.items)) {
        runValue += qty * (priceByName.get(name) ?? 0);
      }
    }
    const runCost = run.estimatedCost ?? 0;
    entry.totalValue += runValue;
    entry.totalCost += runCost;
    entry.runValues.push(runValue);
    if (run.clearTimeSeconds) {
      entry.timedValue += runValue;
      entry.timedCost += runCost;
      entry.timedSeconds += run.clearTimeSeconds;
    }
    byDungeon.set(run.dungeonId, entry);
  }

  return [...byDungeon.entries()]
    .map(([dungeonId, entry]) => {
      const avgValue =
        entry.runCount > 0 ? entry.totalValue / entry.runCount : 0;
      let coefficientOfVariation: number | null = null;
      if (entry.runCount >= 2 && avgValue > 0) {
        const variance =
          entry.runValues.reduce((sum, v) => sum + (v - avgValue) ** 2, 0) /
          entry.runValues.length;
        coefficientOfVariation = Math.sqrt(variance) / avgValue;
      }
      const netTotalValue = entry.totalValue - entry.totalCost;
      return {
        dungeonId,
        runCount: entry.runCount,
        totalValue: entry.totalValue,
        avgValue,
        hourlyRate:
          entry.timedSeconds > 0
            ? (entry.timedValue / entry.timedSeconds) * 3600
            : null,
        coefficientOfVariation,
        totalCost: entry.totalCost,
        netTotalValue,
        netAvgValue: entry.runCount > 0 ? netTotalValue / entry.runCount : 0,
        netHourlyRate:
          entry.timedSeconds > 0
            ? ((entry.timedValue - entry.timedCost) / entry.timedSeconds) * 3600
            : null,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

export type TrendGranularity = "week" | "month";

/** Boundary of "this period" (RO-week Tuesday-noon reset, or calendar month) and the period immediately before it. */
function trendPeriodBounds(
  granularity: TrendGranularity,
  now: number,
): { thisStart: number; lastStart: number } {
  if (granularity === "week") {
    const thisStart = startOfWeek(new Date(now)).getTime();
    return { thisStart, lastStart: thisStart - 7 * 24 * 60 * 60 * 1000 };
  }
  const thisStart = new Date(now);
  thisStart.setDate(1);
  thisStart.setHours(0, 0, 0, 0);
  const lastStart = new Date(thisStart);
  lastStart.setMonth(lastStart.getMonth() - 1);
  return { thisStart: thisStart.getTime(), lastStart: lastStart.getTime() };
}

function pctChangeOf(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export interface MdPeriodTrend {
  dungeonId: string;
  thisPeriodValue: number;
  lastPeriodValue: number;
  thisPeriodRuns: number;
  lastPeriodRuns: number;
  /** Percent change vs the previous period (e.g. 20 = +20%) — null when the previous period was 0 (nothing to compare against). */
  valuePctChange: number | null;
  runsPctChange: number | null;
}

/** Per-dungeon period-over-period drop value and run-count trend — lets a specific MD's payout or pace shift get noticed even while the overall total looks normal. */
export function getMdPeriodTrend(
  runs: MdRun[],
  prices: ItemPrice[],
  granularity: TrendGranularity,
  now: number = Date.now(),
): MdPeriodTrend[] {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  const { thisStart, lastStart } = trendPeriodBounds(granularity, now);
  const byDungeon = new Map<
    string,
    { thisValue: number; lastValue: number; thisRuns: number; lastRuns: number }
  >();

  function runValue(run: MdRun): number {
    if (!run.items) return 0;
    return Object.entries(run.items).reduce(
      (sum, [name, qty]) => sum + qty * (priceByName.get(name) ?? 0),
      0,
    );
  }

  for (const run of runs) {
    if (run.completedAt < lastStart) continue;
    const entry = byDungeon.get(run.dungeonId) ?? {
      thisValue: 0,
      lastValue: 0,
      thisRuns: 0,
      lastRuns: 0,
    };
    const value = runValue(run);
    if (run.completedAt >= thisStart) {
      entry.thisValue += value;
      entry.thisRuns += 1;
    } else {
      entry.lastValue += value;
      entry.lastRuns += 1;
    }
    byDungeon.set(run.dungeonId, entry);
  }

  return [...byDungeon.entries()].map(([dungeonId, e]) => ({
    dungeonId,
    thisPeriodValue: e.thisValue,
    lastPeriodValue: e.lastValue,
    thisPeriodRuns: e.thisRuns,
    lastPeriodRuns: e.lastRuns,
    valuePctChange: pctChangeOf(e.thisValue, e.lastValue),
    runsPctChange: pctChangeOf(e.thisRuns, e.lastRuns),
  }));
}

export interface ItemSourceBreakdown {
  dungeonId: string;
  dungeonName: string;
  qty: number;
}

export interface ItemPeriodTrend {
  itemName: string;
  thisPeriodQty: number;
  lastPeriodQty: number;
  pctChange: number | null;
  thisPeriodValue: number;
  /** Which MDs this period's thisPeriodQty came from, most first — powers a per-item "どこ産か" breakdown in the UI. */
  sources: ItemSourceBreakdown[];
}

/** Per-item period-over-period acquisition-count trend, aggregated across all MD runs' recorded drops (each run's items are already the player's own share, not the party total). `thisPeriodValue` is the current period's quantity priced at each item's `expectedPrice` (unpriced items value at 0), so the table can show which items account for the most money, not just the most pieces. */
export function getItemPeriodTrend(
  runs: MdRun[],
  granularity: TrendGranularity,
  prices: ItemPrice[],
  dungeons: MdDungeon[],
  now: number = Date.now(),
): ItemPeriodTrend[] {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  const dungeonNameById = new Map(dungeons.map((d) => [d.id, d.name]));
  const { thisStart, lastStart } = trendPeriodBounds(granularity, now);
  const byItem = new Map<
    string,
    { thisQty: number; lastQty: number; sourceQty: Map<string, number> }
  >();

  for (const run of runs) {
    if (run.completedAt < lastStart || !run.items) continue;
    const isThisPeriod = run.completedAt >= thisStart;
    for (const [name, qty] of Object.entries(run.items)) {
      const entry = byItem.get(name) ?? {
        thisQty: 0,
        lastQty: 0,
        sourceQty: new Map<string, number>(),
      };
      if (isThisPeriod) {
        entry.thisQty += qty;
        entry.sourceQty.set(
          run.dungeonId,
          (entry.sourceQty.get(run.dungeonId) ?? 0) + qty,
        );
      } else {
        entry.lastQty += qty;
      }
      byItem.set(name, entry);
    }
  }

  return [...byItem.entries()].map(([itemName, e]) => ({
    itemName,
    thisPeriodQty: e.thisQty,
    lastPeriodQty: e.lastQty,
    pctChange: pctChangeOf(e.thisQty, e.lastQty),
    thisPeriodValue: e.thisQty * (priceByName.get(itemName) ?? 0),
    sources: [...e.sourceQty.entries()]
      .map(([dungeonId, qty]) => ({
        dungeonId,
        dungeonName: dungeonNameById.get(dungeonId) ?? "不明なMD",
        qty,
      }))
      .sort((a, b) => b.qty - a.qty),
  }));
}

/**
 * Realized profit anchored to a manually-set baseline: baselineAmount + profit
 * from transactions after baselineDate. Ported from the reference tool's
 * globalBaseDate mechanism, except the baseline value is typed in directly
 * rather than derived from character money — lets a user starting mid-journey
 * (e.g. an existing large negative balance) declare "as of now, my real net
 * is X" instead of the dashboard assuming a zero start.
 */
export function getBaselineRealizedProfit(
  transactions: FinanceTransaction[],
  baselineDate: number | null,
  baselineAmount: number,
): number {
  if (!baselineDate) return getRealizedProfit(transactions);
  const after = transactions.filter((t) => t.date > baselineDate);
  return baselineAmount + getRealizedProfit(after);
}

/** Sum of characters' cash on hand — N-server characters count x1000 when useNRate is on (ref tool parity, trade logs unaffected). */
export function getTotalCharacterCash(
  characters: Character[],
  useNRate: boolean,
): number {
  return characters.reduce((sum, c) => {
    const money = c.money ?? 0;
    const applyRate = useNRate && isNServerCharacter(c.server);
    return sum + (applyRate ? money * 1000 : money);
  }, 0);
}

/**
 * Net effect of outstanding loans on total assets: money borrowed and not
 * yet repaid is a liability (subtracts), money lent and not yet recovered
 * is an asset (adds). Only the unpaid remainder counts — once fully repaid,
 * a debt stops affecting this. The character's own money field is expected
 * to already reflect any cash physically received/handed over (the user
 * edits it manually), so this only offsets that so total assets isn't
 * inflated/deflated by a loan that nets to zero once settled.
 */
export function getOutstandingDebtBalance(debts: DebtEntry[]): number {
  return debts.reduce((sum, d) => {
    const outstanding = d.amount - d.repaidAmount;
    return sum + (d.direction === "lent" ? outstanding : -outstanding);
  }, 0);
}

/**
 * 合計資産（全部売れたら）: realized profit (baseline-anchored) + unsold
 * inventory value + characters' cash on hand + net debt balance. The single
 * figure the dashboard's total-assets callout and 目標 progress bars are
 * both measured against.
 */
export function getCurrentTotalAssets(params: {
  transactions: FinanceTransaction[];
  inventory: InventoryItem[];
  itemPrices: ItemPrice[];
  characters: Character[];
  debts: DebtEntry[];
  useNRate: boolean;
  baselineDate: number | null;
  baselineAmount: number;
}): number {
  const realized = getBaselineRealizedProfit(
    params.transactions,
    params.baselineDate,
    params.baselineAmount,
  );
  const inventoryValue = getInventoryValue(params.inventory, params.itemPrices);
  // Archived (除外) just hides a character from MD pickers/grids — it isn't
  // a delete, so their cash still counts toward total assets.
  const characterCash = getTotalCharacterCash(
    params.characters,
    params.useNRate,
  );
  const debtBalance = getOutstandingDebtBalance(params.debts);
  return realized + inventoryValue + characterCash + debtBalance;
}

export interface SimplePoint {
  label: string;
  value: number;
}

/** Last N weeks of realized SELL revenue only — mirrors the reference tool's profitChart window. */
export function getWeeklySellRevenue(
  transactions: FinanceTransaction[],
  weeks = 4,
  now: number = Date.now(),
): SimplePoint[] {
  const currentWeekStart = startOfWeek(new Date(now)).getTime();
  const points: SimplePoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = currentWeekStart - i * 7 * 24 * 60 * 60 * 1000;
    const end = start + 7 * 24 * 60 * 60 * 1000;
    const value = transactions
      .filter((t) => t.type === "income" && t.date >= start && t.date < end)
      .reduce((sum, t) => sum + t.amount, 0);
    points.push({ label: i === 0 ? "今週" : `${i}週前`, value });
  }
  return points;
}

/** Last N calendar months of net income (income - expense), always returning `months` points (0 for empty months) — mirrors getWeeklySellRevenue's fixed window so the dashboard chart never goes blank. */
export function getRecentMonthlyNet(
  transactions: FinanceTransaction[],
  months = 6,
  now: number = Date.now(),
): SimplePoint[] {
  const points: SimplePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - i);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const net = transactions
      .filter((t) => t.date >= start.getTime() && t.date < end.getTime())
      .reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      );
    points.push({
      label: `${start.getFullYear()}/${start.getMonth() + 1}月`,
      value: net,
    });
  }
  return points;
}

/**
 * Last N calendar months of MD-drop value (items obtained via MD runs,
 * priced at their expected sell price) — same fixed window as
 * getRecentMonthlyNet, but sourced from MdRun.items rather than realized
 * trade transactions, since MD drops don't create a FinanceTransaction
 * until actually sold. Always positive (estimated value, not profit/loss).
 */
export function getRecentMonthlyMdValue(
  runs: MdRun[],
  prices: ItemPrice[],
  months = 6,
  now: number = Date.now(),
): SimplePoint[] {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  const points: SimplePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - i);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const value = runs
      .filter(
        (r) =>
          r.completedAt >= start.getTime() && r.completedAt < end.getTime(),
      )
      .reduce((sum, r) => {
        if (!r.items) return sum;
        return (
          sum +
          Object.entries(r.items).reduce(
            (s, [name, qty]) => s + qty * (priceByName.get(name) ?? 0),
            0,
          )
        );
      }, 0);
    points.push({
      label: `${start.getFullYear()}/${start.getMonth() + 1}月`,
      value,
    });
  }
  return points;
}

export interface WeeklyNetSummary {
  currentWeekNet: number;
  previousWeekNet: number;
  /** Best net among completed weeks (excludes the still-in-progress current week) — null if there's no completed week with any transaction. */
  bestPastWeekNet: number | null;
  isNewBest: boolean;
}

/**
 * Consecutive weeks (most recent first) whose net income met or exceeded the
 * weekly goal — a motivational streak counter alongside the goal progress
 * bar. The still-in-progress current week counts only if it has ALREADY hit
 * the goal (so an unfinished week can't prematurely break a streak); once a
 * week is missed or has no transaction data at all, counting stops.
 */
export function getWeeklyGoalStreak(
  transactions: FinanceTransaction[],
  weeklyGoal: number,
  now: number = Date.now(),
): number {
  if (weeklyGoal <= 0) return 0;
  const currentWeekStart = startOfWeek(new Date(now)).getTime();
  const buckets = new Map<number, number>();
  for (const t of transactions) {
    const weekStart = startOfWeek(new Date(t.date)).getTime();
    const delta = t.type === "income" ? t.amount : -t.amount;
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + delta);
  }

  let streak = 0;
  let weekStart = currentWeekStart;
  if ((buckets.get(currentWeekStart) ?? 0) >= weeklyGoal) {
    streak += 1;
  }
  weekStart -= 7 * 24 * 60 * 60 * 1000;
  while (true) {
    const net = buckets.get(weekStart);
    if (net === undefined || net < weeklyGoal) break;
    streak += 1;
    weekStart -= 7 * 24 * 60 * 60 * 1000;
  }
  return streak;
}

/** Powers the "先週比・自己ベスト" dashboard callout — motivational week-over-week comparison. */
export function getWeeklyNetSummary(
  transactions: FinanceTransaction[],
  now: number = Date.now(),
): WeeklyNetSummary {
  const currentWeekStart = startOfWeek(new Date(now)).getTime();
  const previousWeekStart = currentWeekStart - 7 * 24 * 60 * 60 * 1000;

  const buckets = new Map<number, number>();
  for (const t of transactions) {
    const weekStart = startOfWeek(new Date(t.date)).getTime();
    const delta = t.type === "income" ? t.amount : -t.amount;
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + delta);
  }

  let bestPastWeekNet: number | null = null;
  for (const [weekStart, net] of buckets) {
    if (weekStart >= currentWeekStart) continue;
    if (bestPastWeekNet === null || net > bestPastWeekNet)
      bestPastWeekNet = net;
  }

  const currentWeekNet = buckets.get(currentWeekStart) ?? 0;
  return {
    currentWeekNet,
    previousWeekNet: buckets.get(previousWeekStart) ?? 0,
    bestPastWeekNet,
    isNewBest: bestPastWeekNet !== null && currentWeekNet > bestPastWeekNet,
  };
}

export interface WeeklyTopSale {
  itemName: string;
  amount: number;
  date: number;
}

/** The single biggest sale (income transaction) within the current RO week — a quick "what carried this week" highlight for the dashboard digest. Null if there's no income this week. */
export function getWeeklyTopSale(
  transactions: FinanceTransaction[],
  now: number = Date.now(),
): WeeklyTopSale | null {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const candidates = transactions.filter(
    (t) => t.type === "income" && t.date >= weekStart && t.date < weekEnd,
  );
  if (candidates.length === 0) return null;
  const top = candidates.reduce((best, t) =>
    t.amount > best.amount ? t : best,
  );
  return { itemName: top.itemName, amount: top.amount, date: top.date };
}

export interface MonthlyNetSummary {
  thisMonthNet: number;
  lastMonthNet: number;
}

/** This-calendar-month vs previous-calendar-month net income — the monthly counterpart to the weekly week-over-week callout. */
export function getMonthlyNetSummary(
  transactions: FinanceTransaction[],
  now: number = Date.now(),
): MonthlyNetSummary {
  const thisMonthStart = new Date(now);
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const netOf = (from: number, to: number) =>
    transactions
      .filter((t) => t.date >= from && t.date < to)
      .reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      );
  return {
    thisMonthNet: netOf(thisMonthStart.getTime(), now),
    lastMonthNet: netOf(lastMonthStart.getTime(), thisMonthStart.getTime()),
  };
}

/** Estimated value of MD items obtained so far this week, priced at their expected sell price — lets the weekly-goal progress count a drop as "earned" the moment it's picked up, instead of only once it's actually sold via a trade record. */
export function getWeeklyMdEstimatedValue(
  runs: MdRun[],
  prices: ItemPrice[],
  now: number = Date.now(),
): number {
  const priceByName = new Map(prices.map((p) => [p.itemName, p.expectedPrice]));
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  return runs
    .filter((r) => r.completedAt >= weekStart && r.completedAt < weekEnd)
    .reduce((sum, r) => {
      if (!r.items) return sum;
      return (
        sum +
        Object.entries(r.items).reduce(
          (s, [name, qty]) => s + qty * (priceByName.get(name) ?? 0),
          0,
        )
      );
    }, 0);
}

export type AssetGranularity = "daily" | "weekly" | "monthly";

function periodKeyForAsset(
  date: number,
  granularity: AssetGranularity,
): number {
  if (granularity === "daily") {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (granularity === "weekly") {
    return startOfWeek(new Date(date)).getTime();
  }
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatAssetLabel(key: number, granularity: AssetGranularity): string {
  const d = new Date(key);
  if (granularity === "daily") {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (granularity === "weekly") {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}週`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}

/** Cumulative running total, anchored so the last point equals currentTotal — mirrors the reference tool's assetChart. */
export function getAssetTrend(
  transactions: FinanceTransaction[],
  currentTotal: number,
  granularity: AssetGranularity,
): SimplePoint[] {
  if (transactions.length === 0) {
    return [
      { label: formatAssetLabel(Date.now(), granularity), value: currentTotal },
    ];
  }
  const groups = new Map<number, number>();
  for (const t of transactions) {
    const key = periodKeyForAsset(t.date, granularity);
    const delta = t.type === "income" ? t.amount : -t.amount;
    groups.set(key, (groups.get(key) ?? 0) + delta);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  let running = 0;
  const rawCumulative = sortedKeys.map((k) => {
    running += groups.get(k) ?? 0;
    return running;
  });
  const diff = currentTotal - (rawCumulative[rawCumulative.length - 1] ?? 0);
  return sortedKeys.map((k, i) => ({
    label: formatAssetLabel(k, granularity),
    value: rawCumulative[i] + diff,
  }));
}

export interface AllTimeHighAsset {
  value: number;
  /** Epoch ms the high point was reached at — null when it's the current moment (no history, or today is the high). */
  reachedAt: number | null;
  isNewHigh: boolean;
}

/**
 * All-time-high total-assets figure — the long-term counterpart to the
 * weekly self-best callout. Reuses getAssetTrend's anchoring approach (every
 * transaction is a running-balance point, shifted so the most recent point
 * equals currentTotal) since inventory/character-cash have no historical
 * record of their own — the same simplification the asset trend chart
 * already relies on.
 */
export function getAllTimeHighAsset(
  transactions: FinanceTransaction[],
  currentTotal: number,
): AllTimeHighAsset {
  if (transactions.length === 0) {
    return { value: currentTotal, reachedAt: null, isNewHigh: true };
  }
  const sorted = [...transactions].sort((a, b) => a.date - b.date);
  let running = 0;
  const points = sorted.map((t) => {
    running += t.type === "income" ? t.amount : -t.amount;
    return { date: t.date, value: running };
  });
  const diff = currentTotal - points[points.length - 1].value;
  let best = { value: currentTotal, reachedAt: null as number | null };
  for (const p of points) {
    const anchored = p.value + diff;
    if (anchored > best.value) best = { value: anchored, reachedAt: p.date };
  }
  return { ...best, isNewHigh: currentTotal >= best.value };
}

export type PeriodGranularity = "week" | "month" | "year";

export interface PeriodSummary {
  key: string;
  label: string;
  year: number;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

/** Start of the "RO week" — Tuesday 12:00, matching the game's own weekly MD reset exactly (see ctCalc.ts's weeklyTue12), not the ISO Monday-start week. Every weekly bucket in this file (asset trend, period summaries, weekly-goal tracking) shares this so "this week" means the same thing everywhere. */
function startOfWeek(d: Date): Date {
  const start = new Date(d);
  const day = start.getDay();
  let diffDays = day >= 2 ? day - 2 : day + 5;
  // Tuesday before noon: the reset hasn't happened yet today, so it's still last week.
  if (day === 2 && start.getHours() < 12) {
    diffDays = 7;
  }
  start.setDate(start.getDate() - diffDays);
  start.setHours(12, 0, 0, 0);
  return start;
}

function periodKeyAndLabel(
  date: number,
  granularity: PeriodGranularity,
): { key: string; label: string; year: number } {
  const d = new Date(date);
  if (granularity === "year") {
    const y = String(d.getFullYear());
    return { key: y, label: `${y}年`, year: d.getFullYear() };
  }
  if (granularity === "month") {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      year: d.getFullYear(),
    };
  }
  const weekStart = startOfWeek(d);
  const key = String(weekStart.getTime());
  const label = `${weekStart.getFullYear()}/${weekStart.getMonth() + 1}/${weekStart.getDate()}の週`;
  return { key, label, year: weekStart.getFullYear() };
}

/** Groups transactions into income/expense/net buckets by week, month, or year, newest first. */
export function groupTransactionsByPeriod(
  transactions: FinanceTransaction[],
  granularity: PeriodGranularity,
): PeriodSummary[] {
  const buckets = new Map<string, PeriodSummary>();
  for (const t of transactions) {
    const { key, label, year } = periodKeyAndLabel(t.date, granularity);
    const bucket = buckets.get(key) ?? {
      key,
      label,
      year,
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0,
    };
    if (t.type === "income") bucket.income += t.amount;
    else bucket.expense += t.amount;
    bucket.net = bucket.income - bucket.expense;
    bucket.transactionCount += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export interface ItemRevenueSummary {
  itemName: string;
  sellCount: number;
  sellQuantity: number;
  totalRevenue: number;
  avgUnitPrice: number;
}

/** Ranks items by total realized sell revenue (income transactions only) — surfaces which items actually earn money, distinct from getMdEfficiency's per-dungeon drop-value estimate. source: "other" (CSV精算表インポート由来) is excluded since its itemName is a free-text settlement description, not a real item name, and would otherwise pollute the ranking. */
export function getItemRevenueBreakdown(
  transactions: FinanceTransaction[],
): ItemRevenueSummary[] {
  const byItem = new Map<
    string,
    { sellCount: number; sellQuantity: number; totalRevenue: number }
  >();
  for (const t of transactions) {
    if (t.type !== "income" || t.source === "other") continue;
    const entry = byItem.get(t.itemName) ?? {
      sellCount: 0,
      sellQuantity: 0,
      totalRevenue: 0,
    };
    entry.sellCount += 1;
    entry.sellQuantity += t.quantity;
    entry.totalRevenue += t.amount;
    byItem.set(t.itemName, entry);
  }
  return [...byItem.entries()]
    .map(([itemName, e]) => ({
      itemName,
      sellCount: e.sellCount,
      sellQuantity: e.sellQuantity,
      totalRevenue: e.totalRevenue,
      avgUnitPrice: e.sellQuantity > 0 ? e.totalRevenue / e.sellQuantity : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface CharacterFinanceSummary {
  characterId: string | null;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

/** Per-character income/expense/net — which characters are actually carrying the account's income, not shown anywhere on the dashboard. Transactions with no characterId (recorded before a character was tagged) bucket under null. */
export function getCharacterFinanceBreakdown(
  transactions: FinanceTransaction[],
): CharacterFinanceSummary[] {
  const byChar = new Map<
    string | null,
    { income: number; expense: number; count: number }
  >();
  for (const t of transactions) {
    const key = t.characterId ?? null;
    const entry = byChar.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "income") entry.income += t.amount;
    else entry.expense += t.amount;
    entry.count += 1;
    byChar.set(key, entry);
  }
  return [...byChar.entries()]
    .map(([characterId, e]) => ({
      characterId,
      income: e.income,
      expense: e.expense,
      net: e.income - e.expense,
      transactionCount: e.count,
    }))
    .sort((a, b) => b.net - a.net);
}

export interface SourceFinanceSummary {
  source: FinanceSource | "unknown";
  income: number;
  expense: number;
  transactionCount: number;
}

/** Income/expense split by where the money came from (MVP card sale, MD drop, open market, other) — which activity is actually paying off. */
export function getSourceFinanceBreakdown(
  transactions: FinanceTransaction[],
): SourceFinanceSummary[] {
  const bySource = new Map<
    string,
    { income: number; expense: number; count: number }
  >();
  for (const t of transactions) {
    const key = t.source ?? "unknown";
    const entry = bySource.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "income") entry.income += t.amount;
    else entry.expense += t.amount;
    entry.count += 1;
    bySource.set(key, entry);
  }
  return [...bySource.entries()]
    .map(([source, e]) => ({
      source: source as FinanceSource | "unknown",
      income: e.income,
      expense: e.expense,
      transactionCount: e.count,
    }))
    .sort((a, b) => b.income - a.income);
}

export interface TagFinanceSummary {
  tag: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

/** Income/expense split by free-text tag — a transaction can carry several tags, so it counts once toward each. Untagged transactions are omitted (there's no meaningful "no tag" bucket to rank). */
export function getTagFinanceBreakdown(
  transactions: FinanceTransaction[],
): TagFinanceSummary[] {
  const byTag = new Map<
    string,
    { income: number; expense: number; count: number }
  >();
  for (const t of transactions) {
    if (!t.tags || t.tags.length === 0) continue;
    for (const tag of t.tags) {
      const entry = byTag.get(tag) ?? { income: 0, expense: 0, count: 0 };
      if (t.type === "income") entry.income += t.amount;
      else entry.expense += t.amount;
      entry.count += 1;
      byTag.set(tag, entry);
    }
  }
  return [...byTag.entries()]
    .map(([tag, e]) => ({
      tag,
      income: e.income,
      expense: e.expense,
      net: e.income - e.expense,
      transactionCount: e.count,
    }))
    .sort((a, b) => b.income - a.income);
}

export interface IncomeConcentration {
  topLabel: string;
  topAmount: number;
  /** 0-100. */
  topPct: number;
  /** 0-100, share held by the top 3 combined (same as topPct when there are fewer than 3 entries). */
  top3Pct: number;
}

/**
 * How concentrated total income is in its single biggest source — the
 * investing-style "concentration risk" lens: a high topPct means one MD/item
 * is carrying most of the income, so a price crash or nerf to that one
 * thing would hurt a lot more than if income were spread out. Pass in
 * whatever breakdown you want concentration for (by item, by source, etc.)
 * as plain {label, amount} pairs; entries with amount <= 0 are ignored.
 * Returns null when there's nothing positive to rank.
 */
export function getIncomeConcentration(
  entries: { label: string; amount: number }[],
): IncomeConcentration | null {
  const positive = entries
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (positive.length === 0) return null;
  const total = positive.reduce((sum, e) => sum + e.amount, 0);
  const top = positive[0];
  const top3 = positive.slice(0, 3).reduce((sum, e) => sum + e.amount, 0);
  return {
    topLabel: top.label,
    topAmount: top.amount,
    topPct: (top.amount / total) * 100,
    top3Pct: (top3 / total) * 100,
  };
}
