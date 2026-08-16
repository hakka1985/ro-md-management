interface Props {
  itemNames: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

/** One checkbox per non-card item registered on the MVP master (MvpMaster.dropItems) — unlike MD's MvpDefeatCheckboxes (defaults to "defeated"), these default to unchecked since a drop isn't guaranteed. Renders nothing when the MVP has no dropItems configured. */
export function MvpItemDropCheckboxes({ itemNames, value, onChange }: Props) {
  if (itemNames.length === 0) return null;

  function toggle(name: string, checked: boolean) {
    onChange(
      checked ? [...value, name] : value.filter((n) => n !== name),
    );
  }

  return (
    <div className="stacked-form" style={{ gap: "0.3rem" }}>
      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        ドロップしたアイテム（カード以外）
      </span>
      {itemNames.map((name) => (
        <label key={name} className="checkbox-label">
          <input
            type="checkbox"
            checked={value.includes(name)}
            onChange={(e) => toggle(name, e.target.checked)}
          />
          {name}
        </label>
      ))}
    </div>
  );
}
