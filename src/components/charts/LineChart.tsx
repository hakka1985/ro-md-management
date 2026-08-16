export interface LineDatum {
  label: string;
  value: number;
}

interface Props {
  data: LineDatum[];
  formatValue?: (n: number) => string;
}

const CHART_HEIGHT = 140;
const POINT_GAP = 70;
const PADDING_X = 24;
const PADDING_Y = 16;
// Floor so 1-2 points don't collapse the chart (and its labels, which need
// room to breathe) down to a sliver — it still grows past this once enough
// points need the extra width.
const MIN_WIDTH = 220;

/** A single-series trend over time (magnitude changing point-to-point) — a line reads the direction of change more clearly than bars, which are better for comparing discrete categories. */
export function LineChart({
  data,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = Math.max(
    MIN_WIDTH,
    (data.length - 1) * POINT_GAP + PADDING_X * 2,
  );

  function toX(i: number): number {
    return data.length === 1
      ? width / 2
      : PADDING_X + (i / (data.length - 1)) * (width - PADDING_X * 2);
  }
  function toY(v: number): number {
    return (
      PADDING_Y +
      (1 - (v - min) / range) * (CHART_HEIGHT - PADDING_Y * 2)
    );
  }

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value), d }));
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${toY(min)} L${points[0].x},${toY(min)} Z`;
  const zeroY = min < 0 && max > 0 ? toY(0) : null;

  return (
    <div className="line-chart">
      <svg
        className="line-chart-svg"
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        width={width}
        height={CHART_HEIGHT}
        preserveAspectRatio="none"
      >
        {zeroY !== null && (
          <line
            className="line-chart-zero"
            x1={0}
            y1={zeroY}
            x2={width}
            y2={zeroY}
          />
        )}
        <path className="line-chart-area" d={areaPath} />
        <path className="line-chart-line" d={linePath} />
        {points.map((p, i) => (
          <circle
            key={p.d.label}
            className="line-chart-point"
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === points.length - 1 ? 4.5 : 3}
          >
            <title>
              {p.d.label}: {formatValue(p.d.value)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="line-chart-labels" style={{ width }}>
        {points.map((p, i) => (
          <span
            key={p.d.label}
            className="line-chart-label"
            style={{ left: p.x }}
          >
            {(i === 0 || i === points.length - 1 || points.length <= 6) && (
              <span className="line-chart-label-value">
                {formatValue(p.d.value)}
              </span>
            )}
            <span className="line-chart-label-text">{p.d.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
