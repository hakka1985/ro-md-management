export interface MasterExportPayload<T> {
  table: string;
  exportedAt: number;
  data: T[];
}

/** Downloads a single master table (MDマスタ/MVPマスタ/アイテムマスタ) as its own JSON file, separate from the full-app export. */
export function downloadMasterExport<T>(tableName: string, data: T[]): void {
  const payload: MasterExportPayload<T> = {
    table: tableName,
    exportedAt: Date.now(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(payload.exportedAt)
    .toISOString()
    .replace(/[-:]/g, "")
    .slice(0, 13);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ro-md-management-${tableName}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === "object" && v !== null)
  );
}

/** Accepts either the {table, exportedAt, data} shape this app produces, or a bare array (so a hand-edited or externally-produced JSON array still works). */
export function parseMasterImport<T>(raw: unknown, tableName: string): T[] {
  if (Array.isArray(raw)) {
    if (!isArrayOfObjects(raw)) {
      throw new Error("インポートファイルの形式が不正です（配列の中身がオブジェクトではありません）。");
    }
    return raw as T[];
  }
  if (typeof raw !== "object" || raw === null) {
    throw new Error(
      "インポートファイルの形式が不正です（JSONオブジェクトまたは配列ではありません）。",
    );
  }
  const obj = raw as Record<string, unknown>;
  if (obj.table !== undefined && obj.table !== tableName) {
    throw new Error(
      `このファイルは「${String(obj.table)}」用のデータです（「${tableName}」用ではありません）。`,
    );
  }
  if (!isArrayOfObjects(obj.data)) {
    throw new Error("インポートファイルにdata配列がありません。");
  }
  return obj.data as T[];
}
