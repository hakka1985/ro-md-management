export interface AllocationDatum {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: AllocationDatum[];
  formatValue?: (n: number) => string;
}

/** 100%-stacked single bar + legend — a portfolio-allocation view (どこに資産が偏っているか), not a magnitude comparison, so a pie/donut isn't needed: a single bar of fixed, always-present categories reads faster than wedges. Entries with value <= 0 are dropped from the bar (nothing to show) but still listed in the legend at 0%. */
export function AllocationBar({
  data,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  if (total <= 0) {
    return <p className="empty">資産データがありません</p>;
  }
  return (
    <div>
      <div className="allocation-bar-track">
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <div
              key={d.label}
              className="allocation-bar-segment"
              style={{ width: `${(d.value / total) * 100}%`, background: d.color }}
              title={`${d.label}: ${formatValue(d.value)}（${((d.value / total) * 100).toFixed(0)}%）`}
            />
          ))}
      </div>
      <ul className="allocation-bar-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="legend-swatch" style={{ background: d.color }} />
            {d.label}: {formatValue(d.value)}（
            {((Math.max(0, d.value) / total) * 100).toFixed(0)}%）
          </li>
        ))}
      </ul>
    </div>
  );
}
