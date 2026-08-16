import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";

const USE_N_RATE_KEY = "useNRate";
const BASELINE_DATE_KEY = "baselineDate";
const BASELINE_AMOUNT_KEY = "baselineAmount";
const WEEKLY_GOAL_KEY = "weeklyGoal";
const MD_GRID_TRANSPOSE_KEY = "mdGridTranspose";
const CASH_FLOW_TARGET_KEY = "cashFlowTarget";
const LAST_EXPORTED_AT_KEY = "lastExportedAt";

export function useAppSettings() {
  const useNRateRow = useLiveQuery(() => db.appConfig.get(USE_N_RATE_KEY), []);
  const useNRate = (useNRateRow?.value as boolean | undefined) ?? false;

  const baselineDateRow = useLiveQuery(
    () => db.appConfig.get(BASELINE_DATE_KEY),
    [],
  );
  const baselineAmountRow = useLiveQuery(
    () => db.appConfig.get(BASELINE_AMOUNT_KEY),
    [],
  );
  const baselineDate = (baselineDateRow?.value as number | undefined) ?? null;
  const baselineAmount = (baselineAmountRow?.value as number | undefined) ?? 0;

  const weeklyGoalRow = useLiveQuery(
    () => db.appConfig.get(WEEKLY_GOAL_KEY),
    [],
  );
  const weeklyGoal = (weeklyGoalRow?.value as number | undefined) ?? 0;

  const mdGridTransposeRow = useLiveQuery(
    () => db.appConfig.get(MD_GRID_TRANSPOSE_KEY),
    [],
  );
  const mdGridTranspose =
    (mdGridTransposeRow?.value as boolean | undefined) ?? false;

  const cashFlowTargetRow = useLiveQuery(
    () => db.appConfig.get(CASH_FLOW_TARGET_KEY),
    [],
  );
  const cashFlowTarget = (cashFlowTargetRow?.value as number | undefined) ?? 0;

  const lastExportedAtRow = useLiveQuery(
    () => db.appConfig.get(LAST_EXPORTED_AT_KEY),
    [],
  );
  const lastExportedAt =
    (lastExportedAtRow?.value as number | undefined) ?? null;

  async function setUseNRate(value: boolean) {
    await db.appConfig.put({ key: USE_N_RATE_KEY, value });
  }

  /** Records "as of right now, my true net balance is `amount`" — later dashboard totals become amount + sum of trades after this moment, matching the reference tool's globalBaseDate/globalBaseMoney mechanism. */
  async function setBaseline(amount: number) {
    await db.appConfig.put({ key: BASELINE_DATE_KEY, value: Date.now() });
    await db.appConfig.put({ key: BASELINE_AMOUNT_KEY, value: amount });
  }

  async function clearBaseline() {
    await db.appConfig.delete(BASELINE_DATE_KEY);
    await db.appConfig.delete(BASELINE_AMOUNT_KEY);
  }

  async function setWeeklyGoal(amount: number) {
    await db.appConfig.put({ key: WEEKLY_GOAL_KEY, value: amount });
  }

  async function toggleMdGridTranspose() {
    await db.appConfig.put({
      key: MD_GRID_TRANSPOSE_KEY,
      value: !mdGridTranspose,
    });
  }

  async function setCashFlowTarget(amount: number) {
    await db.appConfig.put({ key: CASH_FLOW_TARGET_KEY, value: amount });
  }

  async function markExported() {
    await db.appConfig.put({ key: LAST_EXPORTED_AT_KEY, value: Date.now() });
  }

  return {
    useNRate,
    setUseNRate,
    baselineDate,
    baselineAmount,
    setBaseline,
    clearBaseline,
    weeklyGoal,
    setWeeklyGoal,
    mdGridTranspose,
    toggleMdGridTranspose,
    cashFlowTarget,
    setCashFlowTarget,
    lastExportedAt,
    markExported,
  };
}
