import { useState } from "react";
import { useMdDungeons, useMdRuns } from "../md/useMd";
import { getAvailableMdTasksGrouped, getUpcomingMdTasks, formatRemaining } from "../md/ctCalc";
import { useMvpKills } from "../mvp/useMvp";
import {
  useTransactions,
  useInventory,
  useItemPrices,
  useDebts,
} from "../finance/useFinance";
import { useWishlist } from "../wishlist/useWishlist";
import { useCharacters } from "../characters/useCharacters";
import { useAppSettings } from "../settings/useAppSettings";
import {
  getInventoryValue,
  getMdEfficiency,
  getMdWeeklyTrend,
  getWeeklySellRevenue,
  getAssetTrend,
  getTotalCharacterCash,
  getBaselineRealizedProfit,
  getRecentMonthlyNet,
  getRecentMonthlyMdValue,
  getWeeklyNetSummary,
  getWeeklyMdEstimatedValue,
  getOutstandingDebtBalance,
  getWeeklyGoalStreak,
  getAllTimeHighAsset,
  getWeeklyTopSale,
  getMonthlyNetSummary,
  type AssetGranularity,
} from "../../lib/financeCalc";
import { formatDate } from "../../lib/date";
import { BarChart } from "../../components/charts/BarChart";
import { DivergingBarChart } from "../../components/charts/DivergingBarChart";
import { VerticalBarChart } from "../../components/charts/VerticalBarChart";
import { LineChart } from "../../components/charts/LineChart";
import { AllocationBar } from "../../components/charts/AllocationBar";
import { formatZ } from "../../lib/zeny";
import { sortItems, type SortDir } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";

const ASSET_VIEWS: { key: AssetGranularity; label: string }[] = [
  { key: "daily", label: "日次" },
  { key: "weekly", label: "週次" },
  { key: "monthly", label: "月次" },
];

type MonthlyView = "all" | "md";
const MONTHLY_VIEWS: { key: MonthlyView; label: string }[] = [
  { key: "all", label: "全体" },
  { key: "md", label: "MD" },
];

interface Props {
  onRecordCharacter?: (dungeonId: string, characterId: string) => void;
}

export function DashboardPage({ onRecordCharacter }: Props) {
  const { dungeons } = useMdDungeons();
  const { runs } = useMdRuns();
  const { kills } = useMvpKills();
  const { transactions } = useTransactions();
  const { inventory } = useInventory();
  const { itemPrices } = useItemPrices();
  const { items: wishlistItems } = useWishlist();
  const { debts } = useDebts();
  const { characters } = useCharacters();
  const { useNRate, baselineDate, baselineAmount, weeklyGoal } =
    useAppSettings();
  const [assetView, setAssetView] = useState<AssetGranularity>("weekly");
  const [monthlyView, setMonthlyView] = useState<MonthlyView>("all");
  const [efficiencySearch, setEfficiencySearch] = useState("");
  const [efficiencySortKey, setEfficiencySortKey] = useState<string | null>(
    null,
  );
  const [efficiencySortDir, setEfficiencySortDir] = useState<SortDir>("asc");

  if (
    !dungeons ||
    !runs ||
    !kills ||
    !transactions ||
    !inventory ||
    !itemPrices ||
    !wishlistItems ||
    !debts ||
    !characters
  ) {
    return null;
  }

  const dungeonNameById = new Map(dungeons.map((d) => [d.id, d.name]));
  const realized = getBaselineRealizedProfit(
    transactions,
    baselineDate,
    baselineAmount,
  );
  const inventoryValue = getInventoryValue(inventory, itemPrices);
  // Archived (除外) just hides a character from MD pickers/grids — it isn't
  // a delete, so their cash still counts toward total assets.
  const characterCash = getTotalCharacterCash(characters, useNRate);
  const debtBalance = getOutstandingDebtBalance(debts);
  const totalAssets = realized + inventoryValue + characterCash + debtBalance;
  const efficiency = getMdEfficiency(runs, itemPrices).filter(
    (e) => e.runCount > 0,
  );
  const pendingWishlist = wishlistItems.filter((i) => !i.obtained).length;

  // The live dashboard view resets at the baseline (収益 tab stays full-history for looking back at arbitrary periods).
  const trendTransactions = baselineDate
    ? transactions.filter((t) => t.date > baselineDate)
    : transactions;
  const trendRuns = baselineDate
    ? runs.filter((r) => r.completedAt > baselineDate)
    : runs;
  const weeklySell = getWeeklySellRevenue(trendTransactions);
  const assetTrend = getAssetTrend(trendTransactions, totalAssets, assetView);
  const monthlyNet = getRecentMonthlyNet(trendTransactions, 12);
  const monthlyMdValue = getRecentMonthlyMdValue(trendRuns, itemPrices, 12);

  const efficiencyBars = efficiency.map((e) => ({
    label: dungeonNameById.get(e.dungeonId) ?? "（不明なMD）",
    value: e.totalValue,
  }));

  function toggleEfficiencySort(key: string) {
    if (efficiencySortKey === key) {
      setEfficiencySortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setEfficiencySortKey(key);
      setEfficiencySortDir("asc");
    }
  }
  const weeklyTrendByDungeon = new Map(
    getMdWeeklyTrend(runs, itemPrices).map((t) => [t.dungeonId, t]),
  );
  const efficiencyRowsAll = efficiency.map((e) => ({
    ...e,
    dungeonName: dungeonNameById.get(e.dungeonId) ?? "（不明なMD）",
    trend: weeklyTrendByDungeon.get(e.dungeonId) ?? null,
  }));
  const efficiencyRowsFiltered = efficiencyRowsAll.filter((e) =>
    e.dungeonName.toLowerCase().includes(efficiencySearch.trim().toLowerCase()),
  );
  const efficiencyRows = sortItems(
    efficiencyRowsFiltered,
    efficiencySortKey,
    efficiencySortDir,
    (r, key) => {
      switch (key) {
        case "dungeonName":
          return r.dungeonName;
        case "runCount":
          return r.runCount;
        case "totalValue":
          return r.totalValue;
        case "avgValue":
          return r.avgValue;
        case "hourlyRate":
          return r.hourlyRate ?? -1;
        case "netHourlyRate":
          return r.netHourlyRate ?? -1;
        case "coefficientOfVariation":
          return r.coefficientOfVariation ?? -1;
        default:
          return "";
      }
    },
  );

  const weeklyNet = getWeeklyNetSummary(trendTransactions);
  const weeklyMdEstimate = getWeeklyMdEstimatedValue(trendRuns, itemPrices);
  const weeklyEstimatedTotal = weeklyNet.currentWeekNet + weeklyMdEstimate;
  const goalProgress =
    weeklyGoal > 0
      ? Math.min(100, (weeklyEstimatedTotal / weeklyGoal) * 100)
      : 0;
  const weekOverWeekDelta = weeklyNet.currentWeekNet - weeklyNet.previousWeekNet;
  const weekOverWeekPct =
    weeklyNet.previousWeekNet !== 0
      ? (weekOverWeekDelta / Math.abs(weeklyNet.previousWeekNet)) * 100
      : null;

  const availableTaskGroups = getAvailableMdTasksGrouped(
    dungeons.filter((d) => !d.archived),
    characters.filter((c) => !c.archived),
    runs,
  );
  const totalAvailableTasks = availableTaskGroups.reduce(
    (sum, g) => sum + g.characters.length,
    0,
  );
  const efficiencyByDungeon = new Map(efficiency.map((e) => [e.dungeonId, e]));
  const availableTaskGroupsWithValue = availableTaskGroups
    .map((g) => ({
      ...g,
      estimatedValue:
        (efficiencyByDungeon.get(g.dungeonId)?.avgValue ?? 0) *
        g.characters.length,
    }))
    // Best ROI first — clear the highest-value MDs before the rest so the
    // limited play time goes to what actually pays off most.
    .sort((a, b) => b.estimatedValue - a.estimatedValue);
  const upcomingTasks = getUpcomingMdTasks(
    dungeons.filter((d) => !d.archived),
    characters.filter((c) => !c.archived),
    runs,
  );
  const totalMissedValue = availableTaskGroupsWithValue.reduce(
    (sum, g) => sum + g.estimatedValue,
    0,
  );

  const goalStreak = getWeeklyGoalStreak(trendTransactions, weeklyGoal);
  const allTimeHigh = getAllTimeHighAsset(trendTransactions, totalAssets);
  const weeklyTopSale = getWeeklyTopSale(trendTransactions);
  const monthlyNetSummary = getMonthlyNetSummary(trendTransactions);
  const monthOverMonthPct =
    monthlyNetSummary.lastMonthNet !== 0
      ? ((monthlyNetSummary.thisMonthNet - monthlyNetSummary.lastMonthNet) /
          Math.abs(monthlyNetSummary.lastMonthNet)) *
        100
      : null;

  const ASSET_MILESTONES = [
    10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000,
  ];
  const MVP_MILESTONES = [10, 50, 100, 500];
  const MD_MILESTONES = [50, 100, 500, 1000];
  const achievements = [
    ...ASSET_MILESTONES.map((m) => ({
      id: `asset-${m}`,
      title: `資産 ${formatZ(m)} 突破`,
      desc: "合計資産（全部売れたら）が基準を超えました",
      unlocked: totalAssets >= m,
    })),
    ...MVP_MILESTONES.map((m) => ({
      id: `mvp-${m}`,
      title: `MVP討伐 ${m}体`,
      desc: `累計討伐数が${m}体に到達しました`,
      unlocked: kills.length >= m,
    })),
    ...MD_MILESTONES.map((m) => ({
      id: `md-${m}`,
      title: `MD周回 ${m}回`,
      desc: `累計周回数が${m}回に到達しました`,
      unlocked: runs.length >= m,
    })),
  ];
  const bestMdThisWeek = [...weeklyTrendByDungeon.values()]
    .filter((t) => t.thisWeekValue > 0)
    .sort((a, b) => b.thisWeekValue - a.thisWeekValue)[0];

  const allocationParts = [
    { label: "所持金（現金）", value: characterCash, color: "var(--accent)" },
    { label: "在庫評価額", value: inventoryValue, color: "var(--good)" },
    {
      label: "実績利益",
      value: Math.max(0, realized),
      color: "var(--accent2)",
    },
  ];

  return (
    <div className="page">
      <div className="three-col">
        <section className="panel">
          <h2>サマリ</h2>
          <ul className="stat-list">
            <li>MVP討伐総数: {kills.length}体</li>
            <li>MD周回総数: {runs.length}回</li>
            <li title={`${realized.toLocaleString()} z`}>
              実績利益: {formatZ(realized)}
            </li>
            <li title={`${inventoryValue.toLocaleString()} z`}>
              在庫評価額（予想利益）: {formatZ(inventoryValue)}
            </li>
            <li title={`${characterCash.toLocaleString()} z`}>
              所持金合計: {formatZ(characterCash)}
            </li>
            {debtBalance !== 0 && (
              <li title={`${debtBalance.toLocaleString()} z`}>
                貸し借り収支: {debtBalance >= 0 ? "+" : ""}
                {formatZ(debtBalance)}
                {debtBalance < 0 ? "（借り超過）" : "（貸し超過）"}
              </li>
            )}
            <li title={`${totalAssets.toLocaleString()} z`}>
              <strong>合計資産（全部売れたら）: {formatZ(totalAssets)}</strong>
              {allTimeHigh.isNewHigh && (
                <span className="best-badge" style={{ marginLeft: "0.5rem" }}>
                  🏆史上最高
                </span>
              )}
            </li>
            {!allTimeHigh.isNewHigh && (
              <li
                className="hint"
                title={`${allTimeHigh.value.toLocaleString()} z`}
              >
                史上最高資産: {formatZ(allTimeHigh.value)}
                {allTimeHigh.reachedAt &&
                  `（${formatDate(allTimeHigh.reachedAt)}）`}
              </li>
            )}
            <li>欲しいものリスト未達成: {pendingWishlist}件</li>
          </ul>
          {baselineDate && (
            <p className="hint" title={`${baselineAmount.toLocaleString()} z`}>
              {new Date(baselineDate).toLocaleDateString()}
              の基準値（{formatZ(baselineAmount)}）を起点に計算しています。設定タブで変更・解除できます。
            </p>
          )}
          <h3 style={{ marginTop: "1rem" }}>資産配分</h3>
          <AllocationBar data={allocationParts} formatValue={formatZ} />
        </section>

        <section className="panel">
          <h2>今週の成績</h2>
          {weeklyGoal > 0 ? (
            <>
              <p title={`${weeklyEstimatedTotal.toLocaleString()} z / ${weeklyGoal.toLocaleString()} z`}>
                今週の実績＋推定: <strong>{formatZ(weeklyEstimatedTotal)}</strong>
                {" / "}目標 {formatZ(weeklyGoal)}
              </p>
              {weeklyMdEstimate > 0 && (
                <p
                  className="hint"
                  title={`実績 ${weeklyNet.currentWeekNet.toLocaleString()} z + MD未売却分 推定 ${weeklyMdEstimate.toLocaleString()} z`}
                >
                  内訳: 実績 {formatZ(weeklyNet.currentWeekNet)} + MD未売却分 推定{" "}
                  {formatZ(weeklyMdEstimate)}
                </p>
              )}
              <div className="progress-bar-track">
                <div
                  className={
                    goalProgress >= 100
                      ? "progress-bar-fill progress-bar-fill-complete goal-complete-pulse"
                      : "progress-bar-fill"
                  }
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <p className="hint">
                {goalProgress >= 100
                  ? "🎉 今週の目標を達成しました！"
                  : `あと ${formatZ(weeklyGoal - weeklyEstimatedTotal)} で目標達成`}
              </p>
            </>
          ) : (
            <p className="hint">
              設定タブで週次目標を決めると、ここに進捗バーが表示されます。
            </p>
          )}
          <p>
            先週比:{" "}
            {weekOverWeekPct !== null ? (
              <strong
                className={weekOverWeekDelta >= 0 ? "wow-positive" : "wow-negative"}
                title={`${weekOverWeekDelta.toLocaleString()} z`}
              >
                {weekOverWeekDelta >= 0 ? "▲" : "▼"}
                {Math.abs(weekOverWeekPct).toFixed(0)}%（
                {weekOverWeekDelta >= 0 ? "+" : ""}
                {formatZ(weekOverWeekDelta)}）
              </strong>
            ) : (
              <span className="hint">先週のデータがありません</span>
            )}
          </p>
          {weeklyNet.isNewBest && (
            <p>
              <span className="best-badge">🏆 自己ベスト更新中！</span>
            </p>
          )}
          {goalStreak > 0 && (
            <p>
              <span className="best-badge" title="週次目標を連続で達成している週数です">
                🔥{goalStreak}週連続で目標達成中！
              </span>
            </p>
          )}
        </section>

        <section className="panel">
          <h2>本日のTODO</h2>
          {availableTaskGroups.length === 0 ? (
            <p className="empty">
              現在周回可能なMDはありません。よく頑張りました！
            </p>
          ) : (
            <>
              <p>
                <strong>現在周回可能: {totalAvailableTasks}件</strong>
                {totalMissedValue > 0 && (
                  <span
                    className="hint"
                    title={`${totalMissedValue.toLocaleString()} z（獲得アイテムの平均評価額から推定）`}
                  >
                    {" "}
                    ／ 未消化ぶんの推定価値 約{formatZ(totalMissedValue)}
                  </span>
                )}
              </p>
              <div className="dashboard-todo-scroll">
                {availableTaskGroupsWithValue.map((g) => (
                  <details key={g.dungeonId} className="todo-group">
                    <summary>
                      {g.dungeonName}（{g.characters.length}件
                      {g.estimatedValue > 0 &&
                        `・約${formatZ(g.estimatedValue)}`}
                      ）
                    </summary>
                    <ul className="entity-list">
                      {g.characters.map((c) => (
                        <li key={c.id}>
                          {onRecordCharacter ? (
                            <button
                              type="button"
                              className="todo-character-link"
                              onClick={() =>
                                onRecordCharacter(g.dungeonId, c.id)
                              }
                              title="MD進捗でこのキャラの周回を記録する"
                            >
                              {c.name}
                            </button>
                          ) : (
                            <span className="entity-list-main">{c.name}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </>
          )}
          {upcomingTasks.length > 0 && (
            <details className="todo-group">
              <summary>まもなく周回可能（{upcomingTasks.length}件）</summary>
              <ul className="entity-list">
                {upcomingTasks.map((t) => (
                  <li key={`${t.dungeonId}-${t.characterId}`}>
                    <span className="entity-list-main">
                      {t.dungeonName} / {t.characterName}
                      <span className="entity-list-sub">
                        {formatRemaining(t.availableAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <div className="three-col">
        <section className="panel">
          <h2>週次売上推移</h2>
          <VerticalBarChart
            data={weeklySell}
            formatValue={formatZ}
          />
        </section>

        <section className="panel">
          <h2>資産推移</h2>
          <div className="tab-nav" style={{ marginBottom: "0.75rem" }}>
            {ASSET_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={v.key === assetView ? "tab-active" : ""}
                onClick={() => setAssetView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <LineChart data={assetTrend} formatValue={formatZ} />
        </section>

        <section className="panel">
          <h2>月別収支の推移</h2>
          <div className="tab-nav" style={{ marginBottom: "0.75rem" }}>
            {MONTHLY_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={v.key === monthlyView ? "tab-active" : ""}
                onClick={() => setMonthlyView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          {monthlyView === "all" ? (
            <DivergingBarChart
              data={monthlyNet}
              formatValue={formatZ}
            />
          ) : (
            <>
              <p className="hint">
                MD周回で獲得したアイテムの想定価値（実際に売れたとは限りません）
              </p>
              <VerticalBarChart
                data={monthlyMdValue}
                formatValue={formatZ}
              />
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>MD別効率分析</h2>
        {efficiencyBars.length === 0 ? (
          <p className="empty">
            MD進捗タブで周回を記録すると、ここに効率分析が表示されます。
          </p>
        ) : (
          <>
            <p className="hint">
              時給（z/時）はクリア時間を記録した周回のみから計算されます。MDドロップ入力や手動入力の「クリア時間」欄に入力すると反映されます。
            </p>
            <BarChart
              data={efficiencyBars}
              formatValue={formatZ}
            />
            <input
              placeholder="MD名で検索"
              value={efficiencySearch}
              onChange={(e) => setEfficiencySearch(e.target.value)}
              style={{ width: "100%", margin: "1rem 0 0.5rem" }}
            />
            <div className="scrollable-table">
              <table className="md-master-table">
                <thead>
                  <tr>
                    <SortableHeader
                      label="MD名"
                      sortKey="dungeonName"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="実施回数"
                      sortKey="runCount"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="獲得アイテム評価額合計"
                      sortKey="totalValue"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="平均（z/回）"
                      sortKey="avgValue"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="時給（z/時）"
                      sortKey="hourlyRate"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="純利益時給（z/時）"
                      sortKey="netHourlyRate"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <SortableHeader
                      label="安定性"
                      sortKey="coefficientOfVariation"
                      activeKey={efficiencySortKey}
                      dir={efficiencySortDir}
                      onSort={toggleEfficiencySort}
                    />
                    <th>先週比</th>
                  </tr>
                </thead>
                <tbody>
                  {efficiencyRows.map((e) => (
                    <tr key={e.dungeonId}>
                      <td>{e.dungeonName}</td>
                      <td>{e.runCount}回</td>
                      <td title={`${e.totalValue.toLocaleString()} z`}>
                        {formatZ(e.totalValue)}
                      </td>
                      <td title={`${Math.round(e.avgValue).toLocaleString()} z`}>
                        {formatZ(Math.round(e.avgValue))}
                      </td>
                      <td
                        title={
                          e.hourlyRate !== null
                            ? `${Math.round(e.hourlyRate).toLocaleString()} z`
                            : undefined
                        }
                      >
                        {e.hourlyRate !== null
                          ? formatZ(Math.round(e.hourlyRate))
                          : "—"}
                      </td>
                      <td
                        title={
                          e.netHourlyRate !== null
                            ? `${Math.round(e.netHourlyRate).toLocaleString()} z（消耗品コスト ${e.totalCost.toLocaleString()} z を差し引き）`
                            : undefined
                        }
                      >
                        {e.netHourlyRate !== null
                          ? formatZ(Math.round(e.netHourlyRate))
                          : "—"}
                      </td>
                      <td
                        title={
                          e.coefficientOfVariation !== null
                            ? `ばらつき係数 ${e.coefficientOfVariation.toFixed(2)}（低いほど毎回安定した獲得額）`
                            : "データ不足（2回以上の周回が必要）"
                        }
                      >
                        {e.coefficientOfVariation === null
                          ? "—"
                          : e.coefficientOfVariation < 0.3
                            ? "🟢安定型"
                            : e.coefficientOfVariation < 0.7
                              ? "🟡普通"
                              : "🔴一攫千金型"}
                      </td>
                      <td
                        title={
                          e.trend && e.trend.pctChange !== null
                            ? `今週 ${e.trend.thisWeekValue.toLocaleString()} z / 先週 ${e.trend.lastWeekValue.toLocaleString()} z`
                            : undefined
                        }
                      >
                        {!e.trend || e.trend.pctChange === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              e.trend.pctChange >= 0 ? "trend-up" : "trend-down"
                            }
                          >
                            {e.trend.pctChange >= 0 ? "▲" : "▼"}
                            {Math.abs(e.trend.pctChange).toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {efficiencyRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        一致するMDがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="three-col">
        <section className="panel">
          <h2>今週・今月の振り返り</h2>
          <ul className="stat-list">
            <li>
              今週いちばん稼いだMD:{" "}
              {bestMdThisWeek ? (
                <strong>
                  {dungeonNameById.get(bestMdThisWeek.dungeonId) ??
                    "（不明なMD）"}
                  （{formatZ(bestMdThisWeek.thisWeekValue)}）
                </strong>
              ) : (
                "まだ記録がありません"
              )}
            </li>
            <li>
              今週の最大単発売却:{" "}
              {weeklyTopSale ? (
                <strong>
                  {weeklyTopSale.itemName}（{formatZ(weeklyTopSale.amount)}）
                </strong>
              ) : (
                "まだ記録がありません"
              )}
            </li>
            <li title={`${monthlyNetSummary.thisMonthNet.toLocaleString()} z`}>
              今月の純利益: {formatZ(monthlyNetSummary.thisMonthNet)}
              {monthOverMonthPct !== null && (
                <span
                  className={
                    monthOverMonthPct >= 0 ? "trend-up" : "trend-down"
                  }
                >
                  {" "}
                  （先月比 {monthOverMonthPct >= 0 ? "▲" : "▼"}
                  {Math.abs(monthOverMonthPct).toFixed(0)}%）
                </span>
              )}
            </li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>実績</h2>
        <p className="hint">
          達成済みの実績はハイライト表示されます。長く続けるほど増えていきます。
        </p>
        <div className="achievement-grid">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={
                a.unlocked ? "achievement-badge unlocked" : "achievement-badge"
              }
            >
              <span className="achievement-badge-title">
                {a.unlocked ? "🏆" : "🔒"} {a.title}
              </span>
              <span className="achievement-badge-desc">{a.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
