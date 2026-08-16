// Minimal RFC4180-ish CSV parser (quoted fields, embedded commas/newlines,
// escaped "" quotes) — needed because the reference "精算代" sheet's export
// has multi-line quoted headers and comma-grouped quoted numbers.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip — \r\n line endings are handled by the \n branch
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvImportRow {
  date: number;
  itemName: string;
  amount: number;
  type: "income" | "expense";
}

/**
 * Parses a "精算代"-style settlement sheet export: header rows (target/
 * cumulative-balance/category rows) precede the real header row (starts
 * with "日付"), after which each row is one MD-run or aggregate entry.
 * Only 日付/内容/合計 are used — per-item drop columns aren't reconstructed
 * (see plan: 1 row = 1 transaction, using the row's total value).
 */
export function parseSettlementCsv(text: string): CsvImportRow[] {
  const rows = parseCsv(text.trim());
  const headerIndex = rows.findIndex((r) => r[0]?.trim() === "日付");
  if (headerIndex === -1) return [];

  const header = rows[headerIndex].map((h) => h.trim());
  const dateIdx = header.indexOf("日付");
  const contentIdx = header.indexOf("内容");
  const totalIdx = header.indexOf("合計");
  if (dateIdx === -1 || contentIdx === -1 || totalIdx === -1) return [];

  const results: CsvImportRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const dateStr = r[dateIdx]?.trim();
    const itemName = r[contentIdx]?.trim();
    const totalStr = r[totalIdx]?.replace(/,/g, "").trim();
    if (!dateStr || !itemName || !totalStr) continue;

    const amount = Number(totalStr);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const date = new Date(dateStr).getTime();
    if (Number.isNaN(date)) continue;

    results.push({
      date,
      itemName,
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
    });
  }
  return results;
}
