import { useRef, useState, type ChangeEvent } from "react";
import {
  exportAllData,
  downloadExport,
  importAllData,
  clearAllData,
  type ImportMode,
} from "../../lib/exportImport";
import { seedInitialData } from "../../db/seed";
import { useAppSettings } from "./useAppSettings";
import { formatDate } from "../../lib/date";

const BACKUP_REMINDER_DAYS = 14;

export function ExportImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [message, setMessage] = useState("");
  const { lastExportedAt, markExported } = useAppSettings();

  const daysSinceExport = lastExportedAt
    ? (Date.now() - lastExportedAt) / (24 * 60 * 60 * 1000)
    : null;
  const backupOverdue =
    daysSinceExport === null || daysSinceExport >= BACKUP_REMINDER_DAYS;

  async function handleExport() {
    const payload = await exportAllData();
    downloadExport(payload);
    await markExported();
    setMessage("エクスポートしました。");
  }

  async function handleClearAll() {
    const confirmed = window.confirm(
      "全データを消去し、初期状態（デフォルトのMD/MVP/アイテムマスタのみ）に戻します。この操作は取り消せません。先にエクスポートしておくことをおすすめします。続行しますか？",
    );
    if (!confirmed) return;
    await clearAllData();
    await seedInitialData();
    setMessage("全データを消去し、初期状態に戻しました。");
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mode === "replace") {
      const confirmed = window.confirm(
        "既存のデータをすべて置き換えます。この操作は取り消せません。続行しますか？",
      );
      if (!confirmed) {
        e.target.value = "";
        return;
      }
    }

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      await importAllData(raw, mode);
      setMessage("インポートしました。");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "インポートに失敗しました。",
      );
    } finally {
      e.target.value = "";
    }
  }

  return (
    <section className="panel">
      <h2>エクスポート / インポート</h2>
      <p className="hint">
        別のPCでも使いたい場合は、ここでデータをJSONファイルとして書き出し・読み込みできます。
      </p>
      <p className={backupOverdue ? "form-error" : "hint"}>
        {lastExportedAt
          ? `最後のバックアップ: ${formatDate(lastExportedAt)}（${Math.floor(daysSinceExport ?? 0)}日前）`
          : "まだ一度もバックアップ（エクスポート）していません。"}
        {backupOverdue &&
          ` — データ消失に備えて、そろそろエクスポートしておくのがおすすめです。`}
      </p>
      {message && <p className="form-message">{message}</p>}

      <div className="form-actions">
        <button type="button" onClick={handleExport}>
          エクスポート（JSONダウンロード）
        </button>
      </div>

      <label className="checkbox-label">
        <input
          type="radio"
          name="import-mode"
          checked={mode === "merge"}
          onChange={() => setMode("merge")}
        />
        マージ（既存データに追加）
      </label>
      <label className="checkbox-label">
        <input
          type="radio"
          name="import-mode"
          checked={mode === "replace"}
          onChange={() => setMode("replace")}
        />
        置き換え（既存データを削除してから読み込み）
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

      <h3>全データ消去</h3>
      <p className="hint">
        すべてのデータを消去し、デフォルトのMD/MVP/アイテムマスタのみの初期状態からやり直せます。取り消せないので、先にエクスポートしておくことをおすすめします。
      </p>
      <div className="form-actions">
        <button type="button" onClick={handleClearAll}>
          全データを消去する
        </button>
      </div>
    </section>
  );
}
