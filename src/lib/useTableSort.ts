import { useState } from "react";

export type SortDir = "asc" | "desc";

/** Pure sort — usable outside a hook (e.g. when the sort state has to be declared before an early-return guard elsewhere in the component). */
export function sortItems<T>(
  items: T[],
  sortKey: string | null,
  sortDir: SortDir,
  getValue: (item: T, key: string) => string | number,
): T[] {
  if (!sortKey) return items;
  return [...items].sort((a, b) => {
    const av = getValue(a, sortKey);
    const bv = getValue(b, sortKey);
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "ja");
    return sortDir === "asc" ? cmp : -cmp;
  });
}

/** Click-to-sort state for a table: tracks which column key is active and which direction, and returns the items already sorted. Falls back to the input order when no column is selected (e.g. a manually drag-ordered list). */
export function useTableSort<T>(
  items: T[],
  getValue: (item: T, key: string) => string | number,
) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return {
    sorted: sortItems(items, sortKey, sortDir, getValue),
    sortKey,
    sortDir,
    toggleSort,
  };
}
