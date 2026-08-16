import { GoalForm } from "./GoalForm";
import { GoalsList } from "./GoalsList";

export function GoalsPage() {
  return (
    <div className="page">
      <GoalForm />
      <GoalsList />
    </div>
  );
}
