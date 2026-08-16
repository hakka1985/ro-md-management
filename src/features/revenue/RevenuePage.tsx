import { useState } from "react";
import { useTransactions, useInventory, useItemPrices } from "../finance/useFinance";
import { useCharacters } from "../characters/useCharacters";
import {
  groupTransactionsByPeriod,
  getRealizedProfit,
  getInventoryValue,
  getItemRevenueBreakdown,
  getCharacterFinanceBreakdown,
  getSourceFinanceBreakdown,
  getTagFinanceBreakdown,
  getIncomeConcentration,
  type PeriodGranularity,
  type PeriodSummary,
  type ItemRevenueSummary,
  type CharacterFinanceSummary,
  type SourceFinanceSummary,
  type TagFinanceSummary,
} from "../../lib/financeCalc";
import { formatZ } from "../../lib/zeny";
import { isWithinDateRange } from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { DivergingBarChart } from "../../components/charts/DivergingBarChart";
import type { FinanceSource } from "../../db/types";

const GRANULARITIES: { key: PeriodGranularity; label: string }[] = [
  { key: "week", label: "週別" },
  { key: "month", label: "月別" },
  { key: "year", label: "年別" },
];

const SOURCE_LABELS: Record<FinanceSource | "unknown", string> = {
  mvp: "MVP討伐",
  md: "MD周回",
  market: "市場売買",
  other: "その他",
  unknown: "未分類",
};

function periodSortValue(p: PeriodSummary, key: string): string | number {
  switch (key) {
    case "label":
      return p.key;
    case "transactionCount":
      return p.transactionCount;
    case "income":
      return p.income;
    case "expense":
      return p.expense;
    case "net":
      return p.net;
    default:
      return "";
  }
}

function itemSortValue(i: ItemRevenueSummary, key: string): string | number {
  switch (key) {
    case "itemName":
      return i.itemName;
    case "sellCount":
      return i.sellCount;
    case "sellQuantity":
      return i.sellQuantity;
    case "totalRevenue":
      return i.totalRevenue;
    case "avgUnitPrice":
      return i.avgUnitPrice;
    default:
      return "";
  }
}

function sourceSortValue(s: SourceFinanceSummary, key: string): string | number {
  switch (key) {
    case "source":
      return SOURCE_LABELS[s.source];
    case "transactionCount":
      return s.transactionCount;
    case "income":
      return s.income;
    case "expense":
      return s.expense;
    default:
      return "";
  }
}

function tagSortValue(t: TagFinanceSummary, key: string): string | number {
  switch (key) {
    case "tag":
      return t.tag;
    case "transactionCount":
      return t.transactionCount;
    case "income":
      return t.income;
    case "expense":
      return t.expense;
    case "net":
      return t.net;
    default:
      return "";
  }
}

interface CharacterFinanceRow extends CharacterFinanceSummary {
  characterName: string;
}

function characterSortValue(
  c: CharacterFinanceRow,
  key: string,
): string | number {
  switch (key) {
    case "characterName":
      return c.characterName;
    case "transactionCount":
      return c.transactionCount;
    case "income":
      return c.income;
    case "expense":
      return c.expense;
    case "net":
      return c.net;
    default:
      return "";
  }
}

export function RevenuePage() {
  const { transactions } = useTransactions();
  const { inventory } = useInventory();
  const { itemPrices } = useItemPrices();
  const { characters } = useCharacters();
  const [granularity, setGranularity] = useState<PeriodGranularity>("month");
  const [periodDateFrom, setPeriodDateFrom] = useState("");
  const [periodDateTo, setPeriodDateTo] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const characterNameById = new Map(
    (characters ?? []).map((c) => [c.id, c.name]),
  );

  const periodTransactions =
    periodDateFrom || periodDateTo
      ? transactions.filter((t) =>
          isWithinDateRange(t.date, periodDateFrom, periodDateTo),
        )
      : transactions;
  const periods = groupTransactionsByPeriod(periodTransactions, granularity);
  // Chart reads left-to-right chronologically, independent of the table's
  // sort (which defaults to newest-first and can be re-sorted by the user).
  const periodChartData = [...periods]
    .reverse()
    .map((p) => ({ label: p.label, value: p.net }));
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalNet = getRealizedProfit(transactions);
  const inventoryValue = getInventoryValue(inventory, itemPrices);
  const inventoryQtyByName = new Map(
    inventory.map((i) => [i.itemName, i.quantity]),
  );
  const priceByName = new Map(
    itemPrices.map((p) => [p.itemName, p.expectedPrice]),
  );
  const itemBreakdownAll = getItemRevenueBreakdown(transactions);
  const itemBreakdownFiltered = itemBreakdownAll.filter((i) =>
    i.itemName.toLowerCase().includes(itemSearch.trim().toLowerCase()),
  );
  const characterBreakdownAll = getCharacterFinanceBreakdown(
    transactions,
  ).map((c) => ({
    ...c,
    characterName: c.characterId
      ? characterNameById.get(c.characterId) ?? "（不明なキャラ）"
      : "未指定",
  }));
  const characterBreakdownFiltered = characterBreakdownAll.filter((c) =>
    c.characterName.toLowerCase().includes(characterSearch.trim().toLowerCase()),
  );
  const sourceBreakdown = getSourceFinanceBreakdown(transactions);
  const tagBreakdownAll = getTagFinanceBreakdown(transactions);
  const tagBreakdownFiltered = tagBreakdownAll.filter((t) =>
    t.tag.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  // Concentration risk (投資でいう集中リスク): how much of total income rides
  // on the single biggest item or the single biggest income category.
  const itemConcentration = getIncomeConcentration(
    itemBreakdownAll.map((i) => ({ label: i.itemName, amount: i.totalRevenue })),
  );
  const sourceConcentration = getIncomeConcentration(
    sourceBreakdown.map((s) => ({
      label: SOURCE_LABELS[s.source],
      amount: s.income,
    })),
  );

  const periodSort = useTableSort(periods, periodSortValue);
  const itemSort = useTableSort(itemBreakdownFiltered, itemSortValue);
  const characterSort = useTableSort(
    characterBreakdownFiltered,
    characterSortValue,
  );
  const sourceSort = useTableSort(sourceBreakdown, sourceSortValue);
  const tagSort = useTableSort(tagBreakdownFiltered, tagSortValue);

  if (transactions.length === 0) {
    return (
      <div className="page">
        <section className="panel">
          <h2>収益管理</h2>
          <p className="empty">
            取引記録タブで売却・購入を記録すると、ここに詳細な統計・分析結果が表示されます。サマリーはダッシュボードで確認できます。
          </p>
          {inventoryValue > 0 && (
            <p title={`${inventoryValue.toLocaleString()} z`}>
              予想利益（現在の在庫評価額）: <strong>{formatZ(inventoryValue)}</strong>
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>収益サマリ（全期間）</h2>
        <ul className="stat-list">
          <li>取引件数: {transactions.length}件</li>
          <li title={`${totalIncome.toLocaleString()} z`}>
            総収入: {formatZ(totalIncome)}
          </li>
          <li title={`${totalExpense.toLocaleString()} z`}>
            総支出: {formatZ(totalExpense)}
          </li>
          <li title={`${totalNet.toLocaleString()} z`}>
            <strong>純利益（実現済み）: {formatZ(totalNet)}</strong>
          </li>
          <li title={`${inventoryValue.toLocaleString()} z`}>
            予想利益（現在の在庫評価額）: {formatZ(inventoryValue)}
          </li>
        </ul>
        <p className="hint">
          収益タブは基準値に関わらず常に全期間の取引記録を対象にします（ダッシュボードは基準値設定時、基準日以降のみ対象）。
          「純利益」は実際に売却済みの実績、「予想利益」はまだ売っていない在庫を想定単価で
          評価した金額です（実際にその値段で売れるとは限りません）。
        </p>
        {(itemConcentration || sourceConcentration) && (
          <ul className="stat-list">
            {sourceConcentration && (
              <li
                title={`${sourceConcentration.topAmount.toLocaleString()} z`}
              >
                収入源の集中度: 最大の収入源「{sourceConcentration.topLabel}
                」だけで収入の{sourceConcentration.topPct.toFixed(0)}%
              </li>
            )}
            {itemConcentration && (
              <li title={`${itemConcentration.topAmount.toLocaleString()} z`}>
                アイテムの集中度: 最大の売却元「{itemConcentration.topLabel}
                」だけで収入の{itemConcentration.topPct.toFixed(0)}
                %、上位3アイテムで{itemConcentration.top3Pct.toFixed(0)}%
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>期間別収支</h2>
        <div
          className="tab-nav"
          style={{
            marginBottom: "0.75rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              className={g.key === granularity ? "tab-active" : ""}
              onClick={() => setGranularity(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <DateRangeFilter
          from={periodDateFrom}
          to={periodDateTo}
          onFromChange={setPeriodDateFrom}
          onToChange={setPeriodDateTo}
        />
        <DivergingBarChart data={periodChartData} formatValue={formatZ} />
        <div className="scrollable-table" style={{ marginTop: "1rem" }}>
          <table className="md-master-table">
            <thead>
              <tr>
                <SortableHeader
                  label="期間"
                  sortKey="label"
                  activeKey={periodSort.sortKey}
                  dir={periodSort.sortDir}
                  onSort={periodSort.toggleSort}
                />
                <SortableHeader
                  label="取引件数"
                  sortKey="transactionCount"
                  activeKey={periodSort.sortKey}
                  dir={periodSort.sortDir}
                  onSort={periodSort.toggleSort}
                />
                <SortableHeader
                  label="収入"
                  sortKey="income"
                  activeKey={periodSort.sortKey}
                  dir={periodSort.sortDir}
                  onSort={periodSort.toggleSort}
                />
                <SortableHeader
                  label="支出"
                  sortKey="expense"
                  activeKey={periodSort.sortKey}
                  dir={periodSort.sortDir}
                  onSort={periodSort.toggleSort}
                />
                <SortableHeader
                  label="純利益"
                  sortKey="net"
                  activeKey={periodSort.sortKey}
                  dir={periodSort.sortDir}
                  onSort={periodSort.toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {periodSort.sorted.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td>{p.transactionCount}件</td>
                  <td title={`${p.income.toLocaleString()} z`}>
                    {formatZ(p.income)}
                  </td>
                  <td title={`${p.expense.toLocaleString()} z`}>
                    {formatZ(p.expense)}
                  </td>
                  <td title={`${p.net.toLocaleString()} z`}>
                    {p.net >= 0 ? "+" : ""}
                    {formatZ(p.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>アイテム別売上ランキング</h2>
        <p className="hint">売却（収入）として記録された取引のみを集計します。</p>
        <input
          placeholder="アイテム名で検索"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          style={{ width: "100%", margin: "0.5rem 0" }}
        />
        <div className="scrollable-table">
          <table className="md-master-table">
            <thead>
              <tr>
                <SortableHeader
                  label="アイテム名"
                  sortKey="itemName"
                  activeKey={itemSort.sortKey}
                  dir={itemSort.sortDir}
                  onSort={itemSort.toggleSort}
                />
                <SortableHeader
                  label="売却回数"
                  sortKey="sellCount"
                  activeKey={itemSort.sortKey}
                  dir={itemSort.sortDir}
                  onSort={itemSort.toggleSort}
                />
                <SortableHeader
                  label="売却数量"
                  sortKey="sellQuantity"
                  activeKey={itemSort.sortKey}
                  dir={itemSort.sortDir}
                  onSort={itemSort.toggleSort}
                />
                <SortableHeader
                  label="売上合計"
                  sortKey="totalRevenue"
                  activeKey={itemSort.sortKey}
                  dir={itemSort.sortDir}
                  onSort={itemSort.toggleSort}
                />
                <SortableHeader
                  label="平均単価"
                  sortKey="avgUnitPrice"
                  activeKey={itemSort.sortKey}
                  dir={itemSort.sortDir}
                  onSort={itemSort.toggleSort}
                />
                <th title="現在の在庫評価額（未実現の予想利益）">現在庫の評価額</th>
              </tr>
            </thead>
            <tbody>
              {itemSort.sorted.map((i) => {
                const stockQty = inventoryQtyByName.get(i.itemName) ?? 0;
                const stockValue = stockQty * (priceByName.get(i.itemName) ?? 0);
                return (
                  <tr key={i.itemName}>
                    <td>{i.itemName}</td>
                    <td>{i.sellCount}回</td>
                    <td>{i.sellQuantity}</td>
                    <td title={`${i.totalRevenue.toLocaleString()} z`}>
                      {formatZ(i.totalRevenue)}
                    </td>
                    <td title={`${Math.round(i.avgUnitPrice).toLocaleString()} z`}>
                      {formatZ(Math.round(i.avgUnitPrice))}
                    </td>
                    <td title={`${stockValue.toLocaleString()} z（在庫${stockQty}個）`}>
                      {stockQty > 0 ? formatZ(stockValue) : "—"}
                    </td>
                  </tr>
                );
              })}
              {itemSort.sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {itemSearch
                      ? "一致するアイテムがありません"
                      : "まだ売却記録がありません"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {tagBreakdownAll.length > 0 && (
        <section className="panel">
          <h2>タグ別収支</h2>
          <p className="hint">
            取引記録に付けたタグごとの集計です（複数タグが付いた取引は各タグに計上されます）。取引記録・取引履歴の編集画面でタグを付けられます。
          </p>
          <input
            placeholder="タグ名で検索"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            style={{ width: "100%", margin: "0.5rem 0" }}
          />
          <div className="scrollable-table">
            <table className="md-master-table">
              <thead>
                <tr>
                  <SortableHeader
                    label="タグ"
                    sortKey="tag"
                    activeKey={tagSort.sortKey}
                    dir={tagSort.sortDir}
                    onSort={tagSort.toggleSort}
                  />
                  <SortableHeader
                    label="取引件数"
                    sortKey="transactionCount"
                    activeKey={tagSort.sortKey}
                    dir={tagSort.sortDir}
                    onSort={tagSort.toggleSort}
                  />
                  <SortableHeader
                    label="収入"
                    sortKey="income"
                    activeKey={tagSort.sortKey}
                    dir={tagSort.sortDir}
                    onSort={tagSort.toggleSort}
                  />
                  <SortableHeader
                    label="支出"
                    sortKey="expense"
                    activeKey={tagSort.sortKey}
                    dir={tagSort.sortDir}
                    onSort={tagSort.toggleSort}
                  />
                  <SortableHeader
                    label="純利益"
                    sortKey="net"
                    activeKey={tagSort.sortKey}
                    dir={tagSort.sortDir}
                    onSort={tagSort.toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {tagSort.sorted.map((t) => (
                  <tr key={t.tag}>
                    <td>{t.tag}</td>
                    <td>{t.transactionCount}件</td>
                    <td title={`${t.income.toLocaleString()} z`}>
                      {formatZ(t.income)}
                    </td>
                    <td title={`${t.expense.toLocaleString()} z`}>
                      {formatZ(t.expense)}
                    </td>
                    <td title={`${t.net.toLocaleString()} z`}>
                      {t.net >= 0 ? "+" : ""}
                      {formatZ(t.net)}
                    </td>
                  </tr>
                ))}
                {tagSort.sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      一致するタグがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>キャラクター別収支</h2>
        <input
          placeholder="キャラクター名で検索"
          value={characterSearch}
          onChange={(e) => setCharacterSearch(e.target.value)}
          style={{ width: "100%", margin: "0.5rem 0" }}
        />
        <div className="scrollable-table">
          <table className="md-master-table">
            <thead>
              <tr>
                <SortableHeader
                  label="キャラクター"
                  sortKey="characterName"
                  activeKey={characterSort.sortKey}
                  dir={characterSort.sortDir}
                  onSort={characterSort.toggleSort}
                />
                <SortableHeader
                  label="取引件数"
                  sortKey="transactionCount"
                  activeKey={characterSort.sortKey}
                  dir={characterSort.sortDir}
                  onSort={characterSort.toggleSort}
                />
                <SortableHeader
                  label="収入"
                  sortKey="income"
                  activeKey={characterSort.sortKey}
                  dir={characterSort.sortDir}
                  onSort={characterSort.toggleSort}
                />
                <SortableHeader
                  label="支出"
                  sortKey="expense"
                  activeKey={characterSort.sortKey}
                  dir={characterSort.sortDir}
                  onSort={characterSort.toggleSort}
                />
                <SortableHeader
                  label="純利益"
                  sortKey="net"
                  activeKey={characterSort.sortKey}
                  dir={characterSort.sortDir}
                  onSort={characterSort.toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {characterSort.sorted.map((c) => (
                <tr key={c.characterId ?? "unassigned"}>
                  <td>{c.characterName}</td>
                  <td>{c.transactionCount}件</td>
                  <td title={`${c.income.toLocaleString()} z`}>
                    {formatZ(c.income)}
                  </td>
                  <td title={`${c.expense.toLocaleString()} z`}>
                    {formatZ(c.expense)}
                  </td>
                  <td title={`${c.net.toLocaleString()} z`}>
                    {c.net >= 0 ? "+" : ""}
                    {formatZ(c.net)}
                  </td>
                </tr>
              ))}
              {characterSort.sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    一致するキャラクターがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>入手経路別内訳</h2>
        <div className="scrollable-table">
          <table className="md-master-table">
            <thead>
              <tr>
                <SortableHeader
                  label="経路"
                  sortKey="source"
                  activeKey={sourceSort.sortKey}
                  dir={sourceSort.sortDir}
                  onSort={sourceSort.toggleSort}
                />
                <SortableHeader
                  label="取引件数"
                  sortKey="transactionCount"
                  activeKey={sourceSort.sortKey}
                  dir={sourceSort.sortDir}
                  onSort={sourceSort.toggleSort}
                />
                <SortableHeader
                  label="収入"
                  sortKey="income"
                  activeKey={sourceSort.sortKey}
                  dir={sourceSort.sortDir}
                  onSort={sourceSort.toggleSort}
                />
                <SortableHeader
                  label="支出"
                  sortKey="expense"
                  activeKey={sourceSort.sortKey}
                  dir={sourceSort.sortDir}
                  onSort={sourceSort.toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sourceSort.sorted.map((s) => (
                <tr key={s.source}>
                  <td>{SOURCE_LABELS[s.source]}</td>
                  <td>{s.transactionCount}件</td>
                  <td title={`${s.income.toLocaleString()} z`}>
                    {formatZ(s.income)}
                  </td>
                  <td title={`${s.expense.toLocaleString()} z`}>
                    {formatZ(s.expense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
