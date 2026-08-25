import { useState, type FormEvent } from "react";
import { useAppSettings } from "./useAppSettings";
import { parseZeny, formatZ } from "../../lib/zeny";

export function AppSettingsPanel() {
  const {
    useNRate,
    setUseNRate,
    weeklyGoal,
    setWeeklyGoal,
    maxBaseLevel,
    setMaxBaseLevel,
    maxJobLevel,
    setMaxJobLevel,
  } = useAppSettings();
  const [weeklyGoalInput, setWeeklyGoalInput] = useState("");
  const [maxBaseLevelInput, setMaxBaseLevelInput] = useState("");
  const [maxJobLevelInput, setMaxJobLevelInput] = useState("");

  async function handleWeeklyGoalSubmit(e: FormEvent) {
    e.preventDefault();
    await setWeeklyGoal(parseZeny(weeklyGoalInput));
    setWeeklyGoalInput("");
  }

  async function handleMaxLevelSubmit(e: FormEvent) {
    e.preventDefault();
    const base = Number(maxBaseLevelInput);
    const job = Number(maxJobLevelInput);
    if (maxBaseLevelInput.trim() && !Number.isNaN(base)) {
      await setMaxBaseLevel(base);
    }
    if (maxJobLevelInput.trim() && !Number.isNaN(job)) {
      await setMaxJobLevel(job);
    }
    setMaxBaseLevelInput("");
    setMaxJobLevelInput("");
  }

  return (
    <section className="panel">
      <h2>表示・計算設定</h2>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={useNRate}
          onChange={(e) => setUseNRate(e.target.checked)}
        />
        N鯖のキャラの所持金はN鯖レート(x1000)にする
      </label>
      <p className="hint">
        サーバー名に「N」「N鯖」「Noatun」を含むキャラの所持金を、ダッシュボードの合計資産計算時のみ1000倍します（取引記録には影響しません）。
      </p>

      <h3>週次目標</h3>
      <p className="hint">
        1週間の収支目標額を設定すると、ダッシュボードに進捗バーが表示されます。
      </p>
      <p>
        現在の週次目標:{" "}
        <strong title={weeklyGoal > 0 ? `${weeklyGoal.toLocaleString()} z` : undefined}>
          {weeklyGoal > 0 ? formatZ(weeklyGoal) : "未設定"}
        </strong>
      </p>
      <form className="inline-form" onSubmit={handleWeeklyGoalSubmit}>
        <input
          placeholder="週次目標額（例: 500k, 2M）"
          value={weeklyGoalInput}
          onChange={(e) => setWeeklyGoalInput(e.target.value)}
          required
        />
        <button type="submit">保存する</button>
        {weeklyGoal > 0 && (
          <button type="button" onClick={() => setWeeklyGoal(0)}>
            目標を解除
          </button>
        )}
      </form>

      <h3>カンストレベル設定</h3>
      <p className="hint">
        Base Lv・Job
        Lvの上限値を設定すると、キャラクター管理でカンストしているキャラを見分けられます。上限は変動するため、変わったらここで更新してください。
      </p>
      <p>
        現在の上限:{" "}
        <strong>Base {maxBaseLevel ?? "未設定"}</strong> /{" "}
        <strong>Job {maxJobLevel ?? "未設定"}</strong>
      </p>
      <form className="inline-form" onSubmit={handleMaxLevelSubmit}>
        <input
          type="number"
          min="1"
          placeholder="Base Lv上限"
          value={maxBaseLevelInput}
          onChange={(e) => setMaxBaseLevelInput(e.target.value)}
          style={{ width: "8rem" }}
        />
        <input
          type="number"
          min="1"
          placeholder="Job Lv上限"
          value={maxJobLevelInput}
          onChange={(e) => setMaxJobLevelInput(e.target.value)}
          style={{ width: "8rem" }}
        />
        <button type="submit">保存する</button>
        {(maxBaseLevel !== null || maxJobLevel !== null) && (
          <button
            type="button"
            onClick={() => {
              setMaxBaseLevel(null);
              setMaxJobLevel(null);
            }}
          >
            上限を解除
          </button>
        )}
      </form>
    </section>
  );
}
