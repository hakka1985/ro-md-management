import { TradeForm } from "./TradeForm";
import { InventoryList } from "./InventoryList";
import { TransactionList } from "./TransactionList";
import { DebtPanel } from "./DebtPanel";
import { PartyObtainPanel } from "./PartyObtainPanel";

export function FinancePage() {
  return (
    <div className="page">
      <div className="two-col">
        <TradeForm />
        <InventoryList />
      </div>
      <PartyObtainPanel />
      <TransactionList />
      <DebtPanel />
    </div>
  );
}
