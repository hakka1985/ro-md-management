import { useRef, useState, type ChangeEvent } from "react";
import {
  downloadMasterExport,
  parseMasterImport,
} from "../lib/masterExportImport";

interface Props<T> {
  label: string;
  tableName: string;
  data: T[];
  onImport: (rows: T[], mode: "merge" | "replace") => Promise<void>;
}

/** Export/import for a single master table, independent of the full-app export/import — for backing up or sharing just this one master's current data. */
export function MasterExportImportPanel<T>({
  label,
  tableName,
  data,
  onImport,
}: Props<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleExport() {
    downloadMasterExport(tableName, data);
    setError("");
    setMessage("エクスポートしました。");
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");

    if (mode === "replace") {
      const confirmed = window.confirm(
        `既存の${label}をすべて削除してから読み込みます。この操作は取り消せません。続行しますか？`,
      );
      if (!confirmed) {
        e.target.value = "";
        return;
      }
    }

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const rows = parseMasterImport<T>(raw, tableName);
      await onImport(rows, mode);
      setMessage(`${rows.length}件をインポートしました。`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "インポートに失敗しました。",
      );
    } finally {
      e.target.value = "";
    }
  }

  return (
    <details className="panel">
      <summary>{label}のエクスポート/インポート</summary>
      <p className="hint">
        {label}だけを個別にJSONファイルとして書き出し・読み込みできます（他のデータには
        影響しません）。バックアップや、別PC・他の人とのマスタ共有に使えます。
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-message">{message}</p>}

      <div className="form-actions">
        <button type="button" onClick={handleExport}>
          エクスポート（JSONダウンロード）
        </button>
      </div>

      <label className="checkbox-label">
        <input
          type="radio"
          checked={mode === "merge"}
          onChange={() => setMode("merge")}
        />
        マージ（既存に追加、IDが一致するものは上書き）
      </label>
      <label className="checkbox-label">
        <input
          type="radio"
          checked={mode === "replace"}
          onChange={() => setMode("replace")}
        />
        置き換え（既存の{label}を削除してから読み込み）
      </label>

      <div className="form-actions">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          インポート（JSONファイルを選択）
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </details>
  );
}
