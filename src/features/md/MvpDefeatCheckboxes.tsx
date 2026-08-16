interface Props {
  mobNames: string[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

/** One checkbox per named MVP mob configured for a dungeon; renders nothing when the dungeon has none configured. */
export function MvpDefeatCheckboxes({ mobNames, value, onChange }: Props) {
  if (mobNames.length === 0) return null;

  return (
    <div className="stacked-form" style={{ gap: "0.3rem" }}>
      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        討伐したMOB
      </span>
      {mobNames.map((mob) => (
        <label key={mob} className="checkbox-label">
          <input
            type="checkbox"
            checked={value[mob] ?? true}
            onChange={(e) => onChange({ ...value, [mob]: e.target.checked })}
          />
          {mob}
        </label>
      ))}
    </div>
  );
}
