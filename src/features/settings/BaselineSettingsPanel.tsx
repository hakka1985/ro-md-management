import { useState, type FormEvent } from "react";
import { useAppSettings } from "./useAppSettings";
import { parseZeny, formatZ } from "../../lib/zeny";

export function BaselineSettingsPanel() {
  const { baselineDate, baselineAmount, setBaseline, clearBaseline } =
    useAppSettings();
  const [baselineInput, setBaselineInput] = useState("");

  async function handleBaselineSubmit(e: FormEvent) {
    e.preventDefault();
    const negative = baselineInput.trim().startsWith("-");
    const amount = parseZeny(baselineInput.replace(/^-/, ""));
    await setBaseline(negative ? -amount : amount);
    setBaselineInput("");
  }

  return (
    <section className="panel">
      <h2>基準値設定</h2>
      <p className="hint">
        今までの記録が不完全、またはこのツールを使い始める前からマイナス収支を抱えている場合など、現時点の実際の収支額を「基準値」として保存できます。以降のダッシュボードは基準値＋基準日時より後の取引だけで計算されます（収益タブは全期間表示のまま変わりません）。
      </p>
      {baselineDate ? (
        <p>
          現在の基準日時: <strong>{new Date(baselineDate).toLocaleString()}</strong>
          {" / "}基準収支額:{" "}
          <strong title={`${baselineAmount.toLocaleString()} z`}>
            {formatZ(baselineAmount)}
          </strong>
        </p>
      ) : (
        <p className="hint">基準値は未設定です（全期間の取引記録で計算されます）。</p>
      )}
      <form className="inline-form" onSubmit={handleBaselineSubmit}>
        <input
          placeholder="基準収支額（例: -104668215700, -100G）"
          value={baselineInput}
          onChange={(e) => setBaselineInput(e.target.value)}
          required
        />
        <button type="submit">現在を基準点として保存</button>
        {baselineDate && (
          <button type="button" onClick={clearBaseline}>
            基準値を解除
          </button>
        )}
      </form>
    </section>
  );
}
