import type { SortDir } from "../lib/useTableSort";

interface Props {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
}

/** Clickable <th> that toggles sort on the given column and shows the active direction. */
export function SortableHeader({ label, sortKey, activeKey, dir, onSort }: Props) {
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {label}
      {activeKey === sortKey ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
