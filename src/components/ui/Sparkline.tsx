export function Sparkline({
  data,
  width = 96,
  height = 32,
  className,
  mirrored = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /**
   * Flip the trend horizontally. SVG does not inherit `dir`, so a
   * right-to-left viewer would otherwise see the line running in the opposite
   * time direction to the axis it sits beside — reading "declining" as
   * "growing". Opt-in rather than reading `dir` here so the component stays
   * usable in isolation and in tests.
   */
  mirrored?: boolean;
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
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* `transform` on the root <svg> mirrors every child in one place —
          doing it on the parent avoids re-deriving the point coordinates. */}
      <g transform={mirrored ? `translate(${width},0) scale(-1,1)` : undefined}>
        <polyline
          points={areaPoints}
          fill="currentColor"
          className="opacity-10"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
