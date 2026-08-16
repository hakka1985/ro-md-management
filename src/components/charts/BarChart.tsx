import { VerticalBarChart } from "./VerticalBarChart";

export interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarDatum[];
  formatValue?: (n: number) => string;
  maxItems?: number;
}

/** Ranks a single magnitude across categories, sorted descending and capped to maxItems — vertical bars (easier to scan than horizontal for this data). */
export function BarChart({
  data,
  formatValue = (n) => n.toLocaleString(),
  maxItems = 8,
}: Props) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  return <VerticalBarChart data={sorted} formatValue={formatValue} />;
}
