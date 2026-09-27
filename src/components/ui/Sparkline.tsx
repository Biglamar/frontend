/**
 * Sparkline — a tiny decorative trend line drawn with two polylines.
 *
 * It used to be `aria-hidden="true"` with no accessible equivalent at all, so
 * it conveyed nothing to a screen reader while sitting right next to a
 * financial figure. It is now a labelled image whose name summarises the
 * trend (length, direction, first/last/min/max) — enough for a non-sighted
 * user to know the shape of the data rather than just "there is a line here".
 *
 * `label` is passed by the caller (StatCard forwards its own stat label) so
 * the announcement names what is trending, e.g. "Earnings: 8 points, trending
 * up from 12 to 31". Without it the summary is still accurate, just less
 * specific.
 */
export function Sparkline({
  data,
  width = 96,
  height = 32,
  className,
  label,
  formatValue,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** What the trend represents, e.g. "Earnings". */
  label?: string;
  /** Overrides how individual values are read out. */
  formatValue?: (v: number) => string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={describeTrend(data, label, formatValue)}
      preserveAspectRatio="none"
    >
      <polyline
        points={areaPoints}
        fill="currentColor"
        className="opacity-10"
        aria-hidden="true"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      />
    </svg>
  );
}

/**
 * Builds the sparkline's accessible name. Kept exported for direct testing —
 * the wording is the accessible name, so it is behaviour, not formatting.
 */
export function describeTrend(
  data: number[],
  label?: string,
  formatValue?: (v: number) => string,
): string {
  const format = formatValue ?? ((v: number) => String(v));
  const first = data[0];
  const last = data[data.length - 1];
  const direction = last > first ? "up" : last < first ? "down" : "flat";
  const subject = label ? `${label}: ` : "";
  return (
    `${subject}${data.length} data points, trending ${direction} ` +
    `from ${format(first)} to ${format(last)}, ` +
    `range ${format(minOf(data))} to ${format(maxOf(data))}`
  );
}

function minOf(data: number[]): number {
  return Math.min(...data);
}

function maxOf(data: number[]): number {
  return Math.max(...data);
}
