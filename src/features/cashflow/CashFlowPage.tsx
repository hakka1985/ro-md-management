import { CashFlowForm } from "./CashFlowForm";
import { CashFlowList } from "./CashFlowList";

export function CashFlowPage() {
  return (
    <div className="page">
      <CashFlowForm />
      <CashFlowList />
    </div>
  );
}
