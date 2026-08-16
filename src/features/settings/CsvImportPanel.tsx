import { useState } from "react";
import { parseSettlementCsv, type CsvImportRow } from "../../lib/csvImport";
import { useTransactions } from "../finance/useFinance";
import { formatZ } from "../../lib/zeny";

export function CsvImportPanel() {
  const { addTransaction } = useTransactions();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<CsvImportRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  function handlePreview() {
    setError("");
    setMessage("");
    const rows = parseSettlementCsv(text);
    if (rows.length === 0) {
      setError(
        "取込可能な行が見つかりませんでした。「日付」列を含むヘッダー行以降のCSVを貼り付けてください。",
      );
      setPreview(null);
      return;
    }
    setPreview(rows);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    for (const row of preview) {
      await addTransaction({
        type: row.type,
        itemName: row.itemName,
        quantity: 1,
        unitPrice: row.amount,
        amount: row.amount,
        date: row.date,
        source: "other",
        memo: "スプレッドシートCSVインポート",
      });
    }
    setImporting(false);
    setMessage(`${preview.length}件を取引記録として取り込みました。`);
    setPreview(null);
    setText("");
  }

  const net = preview?.reduce(
    (sum, r) => sum + (r.type === "income" ? r.amount : -r.amount),
    0,
  );

  return (
    <details className="panel">
      <summary>スプレッドシートCSVインポート</summary>
      <p className="hint">
        Googleスプレッドシートの「精算代」形式のシートをCSVとしてコピーし、下に貼り付けてください（先頭の目標値・累計収支の行があっても構いません）。1行を1件の取引記録として取り込みます（「日付」「内容」「合計」列を使用、アイテム別数量列は取り込みません）。
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-message">{message}</p>}
      <textarea
        placeholder="ここにCSVを貼り付け"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        style={{ width: "100%", height: "8rem" }}
      />
      <div className="form-actions" style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={handlePreview}>
          プレビュー
        </button>
        {preview && (
          <button type="button" onClick={handleImport} disabled={importing}>
            {importing
              ? "取り込み中..."
              : `${preview.length}件をインポートする`}
          </button>
        )}
      </div>
      {preview && net !== undefined && (
        <p className="hint" title={`${net.toLocaleString()} z`}>
          プレビュー: {preview.length}件 / 合計収支{" "}
          {net >= 0 ? "+" : ""}
          {formatZ(net)}
        </p>
      )}
    </details>
  );
}
