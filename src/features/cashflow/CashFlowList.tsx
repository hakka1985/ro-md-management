import { useState, type DragEvent, type FormEvent } from "react";
import { useCashFlowPlan } from "./useCashFlowPlan";
import {
  useTransactions,
  useInventory,
  useItemPrices,
  useDebts,
} from "../finance/useFinance";
import { useCharacters } from "../characters/useCharacters";
import { useAppSettings } from "../settings/useAppSettings";
import {
  getBaselineRealizedProfit,
  getInventoryValue,
  getTotalCharacterCash,
  getOutstandingDebtBalance,
} from "../../lib/financeCalc";
import { formatZ, parseZeny } from "../../lib/zeny";
import { VerticalBarChart } from "../../components/charts/VerticalBarChart";
import { ReorderButtons } from "../../components/ReorderButtons";

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

export function CashFlowList() {
  const { entries, toggleDone, deleteEntry, reorderEntry } =
    useCashFlowPlan();
  const { transactions } = useTransactions();
  const { inventory } = useInventory();
  const { itemPrices } = useItemPrices();
  const { debts } = useDebts();
  const { characters } = useCharacters();
  const {
    useNRate,
    baselineDate,
    baselineAmount,
    cashFlowTarget,
    setCashFlowTarget,
  } = useAppSettings();
  const [targetInput, setTargetInput] = useState("");

  // Archived (除外) just hides a character from MD pickers/grids — it isn't
  // a delete, so their cash still counts toward the starting balance.
  const currentBalance =
    getBaselineRealizedProfit(transactions, baselineDate, baselineAmount) +
    getInventoryValue(inventory, itemPrices) +
    getTotalCharacterCash(characters, useNRate) +
    getOutstandingDebtBalance(debts);

  let running = currentBalance;
  const rows = entries.map((e) => {
    const amount = e.quantity * e.unitPrice;
    running += e.kind === "sell" ? amount : -amount;
    return { entry: e, amount, runningBalance: running };
  });

  const firstCrossingId =
    cashFlowTarget > 0
      ? (rows.find((r) => r.runningBalance >= cashFlowTarget)?.entry.id ??
        null)
      : null;

  const chartData = [
    { label: "現在", value: currentBalance },
    ...rows.map((r) => ({
      label: r.entry.itemName,
      value: r.runningBalance,
    })),
  ];

  function handleTargetSubmit(e: FormEvent) {
    e.preventDefault();
    setCashFlowTarget(parseZeny(targetInput));
    setTargetInput("");
  }

  function moveUp(id: string) {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx <= 0) return;
    reorderEntry(id, entries[idx - 1].id);
  }
  function moveDown(id: string) {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1 || idx >= entries.length - 1) return;
    reorderEntry(id, entries[idx + 1].id);
  }

  return (
    <section className="panel">
      <h2>資金計画</h2>
      <p className="hint">
        「売る予定」「買う予定」を優先順位付きで並べ、その順に実行したと仮定した累計残高を予測します。行はドラッグで並び替えられます。実際に取引記録に反映されるわけではありません（あくまで計画・シミュレーション用です）。
      </p>
      <ul className="stat-list">
        <li title={`${currentBalance.toLocaleString()} z`}>
          現在の資産（起点）: {formatZ(currentBalance)}
        </li>
        {cashFlowTarget > 0 && (
          <li title={`${cashFlowTarget.toLocaleString()} z`}>
            目標金額: {formatZ(cashFlowTarget)}
            {firstCrossingId
              ? "（この計画で到達見込みです）"
              : "（この計画だけでは届きません）"}
          </li>
        )}
      </ul>
      <form className="inline-form" onSubmit={handleTargetSubmit}>
        <input
          placeholder="目標金額（例: 100M）"
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
        />
        <button type="submit">目標を設定</button>
        {cashFlowTarget > 0 && (
          <button type="button" onClick={() => setCashFlowTarget(0)}>
            目標を解除
          </button>
        )}
      </form>

      {entries.length === 0 ? (
        <p className="empty">まだ予定がありません。左のフォームから追加してください。</p>
      ) : (
        <>
          <div style={{ marginTop: "1rem" }}>
            <VerticalBarChart data={chartData} formatValue={formatZ} />
          </div>
          <div className="scrollable-table" style={{ marginTop: "1rem" }}>
            <table className="md-master-table">
              <thead>
                <tr>
                  <th>種別</th>
                  <th>アイテム名</th>
                  <th>数量</th>
                  <th>単価</th>
                  <th>金額</th>
                  <th>累計残高</th>
                  <th>完了</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, amount, runningBalance }) => (
                  <tr
                    key={entry.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("cashFlowId", entry.id)
                    }
                    onDragOver={onDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragId = e.dataTransfer.getData("cashFlowId");
                      if (dragId) reorderEntry(dragId, entry.id);
                    }}
                    className={
                      entry.id === firstCrossingId ? "target-reached-row" : undefined
                    }
                    style={
                      entry.done ? { opacity: 0.5 } : undefined
                    }
                  >
                    <td>{entry.kind === "sell" ? "売る" : "買う"}</td>
                    <td style={{ textDecoration: entry.done ? "line-through" : undefined }}>
                      {entry.itemName}
                      {entry.id === firstCrossingId && " 🎯目標到達"}
                    </td>
                    <td>{entry.quantity}</td>
                    <td
                      title={`${entry.unitPrice.toLocaleString()} z`}
                      draggable={false}
                    >
                      {formatZ(entry.unitPrice)}
                    </td>
                    <td title={`${amount.toLocaleString()} z`} draggable={false}>
                      {entry.kind === "sell" ? "+" : "-"}
                      {formatZ(amount)}
                    </td>
                    <td
                      title={`${runningBalance.toLocaleString()} z`}
                      draggable={false}
                    >
                      {formatZ(runningBalance)}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={entry.done ?? false}
                        onChange={(e) =>
                          toggleDone(entry.id, e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <ReorderButtons
                        onMoveUp={() => moveUp(entry.id)}
                        onMoveDown={() => moveDown(entry.id)}
                        canMoveUp={entries[0]?.id !== entry.id}
                        canMoveDown={entries[entries.length - 1]?.id !== entry.id}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `「${entry.itemName}」の予定を削除しますか？`,
                            )
                          ) {
                            deleteEntry(entry.id);
                          }
                        }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
