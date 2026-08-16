interface Props {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

/** A pair of <input type="date"> filters for time-series tables — pass the resulting from/to strings to lib/date.ts's isWithinDateRange. */
export function DateRangeFilter({ from, to, onFromChange, onToChange }: Props) {
  return (
    <div
      className="inline-form"
      style={{ gap: "0.4rem", alignItems: "center", margin: "0.5rem 0" }}
    >
      <span className="hint">期間</span>
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
      />
      <span className="hint">〜</span>
      <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
      {(from || to) && (
        <button
          type="button"
          onClick={() => {
            onFromChange("");
            onToChange("");
          }}
        >
          期間クリア
        </button>
      )}
    </div>
  );
}
