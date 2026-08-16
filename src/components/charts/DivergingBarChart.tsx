export interface DivergingDatum {
  label: string;
  value: number;
}

interface Props {
  data: DivergingDatum[];
  formatValue?: (n: number) => string;
}

/** Diverging bar chart anchored to a zero baseline — sign carries the color (good/danger), never a series legend. */
export function DivergingBarChart({
  data,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div>
      <div className="diverging-chart-legend">
        <span>
          <span
            className="legend-swatch"
            style={{ background: "var(--good)" }}
          />{" "}
          黒字
        </span>
        <span>
          <span
            className="legend-swatch"
            style={{ background: "var(--danger)" }}
          />{" "}
          赤字
        </span>
      </div>
      <div className="diverging-chart">
        {data.map((d) => (
          <div
            className="diverging-chart-col"
            key={d.label}
            title={`${d.label}: ${formatValue(d.value)}`}
          >
            <div className="diverging-chart-top">
              {d.value > 0 && (
                <div
                  className="diverging-chart-bar"
                  style={{
                    height: `${(d.value / max) * 100}%`,
                    background: "var(--good)",
                  }}
                />
              )}
            </div>
            <div className="diverging-chart-baseline" />
            <div className="diverging-chart-bottom">
              {d.value < 0 && (
                <div
                  className="diverging-chart-bar diverging-chart-bar-neg"
                  style={{
                    height: `${(Math.abs(d.value) / max) * 100}%`,
                    background: "var(--danger)",
                  }}
                />
              )}
            </div>
            <span className="diverging-chart-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
