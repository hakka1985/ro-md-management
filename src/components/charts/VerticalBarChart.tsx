export interface VBarDatum {
  label: string;
  value: number;
}

interface Props {
  data: VBarDatum[];
  formatValue?: (n: number) => string;
}

/** Vertical bars for a short, fixed sequence (e.g. last 4 weeks) — single-hue magnitude, baseline at bottom. */
export function VerticalBarChart({
  data,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="vbar-chart">
      {data.map((d) => (
        <div
          className="vbar-chart-col"
          key={d.label}
          title={`${d.label}: ${formatValue(d.value)}`}
        >
          <span className="vbar-chart-value">{formatValue(d.value)}</span>
          <div className="vbar-chart-track">
            <div
              className="vbar-chart-fill"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 1 : 0)}%`,
              }}
            />
          </div>
          <span className="vbar-chart-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
