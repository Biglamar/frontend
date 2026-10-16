export interface BarChartPoint {
  label: string;
  value: number;
}

/**
 * BarChart — hand-rolled SVG-free bar chart (no charting library is a
 * deliberate dependency choice in this app).
 *
 * ACCESSIBILITY STRATEGY
 * ──────────────────────
 * The visual bars are a purely visual rendering and are marked aria-hidden;
 * the accessible equivalent is a visually-hidden data table carrying the same
 * numbers. That is more robust than per-point ARIA on divs (which has no
 * widely-supported role) and it means every figure is available as real text
 * to a screen reader rather than being reconstructed from bar heights.
 *
 * Hover-only information used to live in a `title` attribute, which is not
 * reachable by keyboard and is not reliably announced. Each bar is now
 * focusable with a visible focus ring and reveals the same tooltip on focus
 * (group-focus-within) as on hover, so a keyboard user gets the identical
 * detail a mouse user does. The tooltip lives inside the aria-hidden subtree
 * on purpose: sighted keyboard users need to *see* it, while assistive tech
 * should read the table once rather than announce every bar again.
 *
 * Colour is never the only signal: negative bars are drawn with a diagonal
 * stripe as well as a different hue, and the value keeps its sign in both the
 * tooltip and the table.
 *
 * Contrast (measured against the rendered backgrounds, WCAG AA):
 *   - bar labels  slate-500 on white = 4.76:1 (was slate-400 = 2.56:1, fail)
 *   - bar labels  slate-400 on slate-900 = 6.96:1 (was slate-500 = 3.75:1, fail)
 *   - negative bar rose-600/80 on white = 3.75:1 (was rose-500/80 = 2.97:1,
 *     below the 3:1 required of a graphical object)
 *   - positive bar indigo-500/80 on white = 3.18:1, unchanged, passes
 */
export function BarChart({
  data,
  height = 160,
  formatValue,
  title = "Bar chart",
}: {
  data: BarChartPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  /** Names the chart for assistive tech, e.g. "Earnings, last 8 weeks". */
  title?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const format = (value: number) =>
    formatValue ? formatValue(value) : String(value);

  return (
    <figure>
      <div className="flex gap-2" style={{ height }} aria-hidden="true">
        {data.map((d) => {
          const pct = Math.max((d.value / max) * 100, 2);
          // The 2% floor above keeps a zero (or near-zero) value visible
          // instead of collapsing to nothing, but that same floor made a
          // negative value render as an identical small bar with no visual
          // distinction from a genuine zero/near-zero positive — the sign
          // was completely lost. A distinct color at least keeps the sign
          // visible at a glance; the hover tooltip below still shows the
          // exact signed figure either way (#206).
          const isNegative = d.value < 0;
          return (
            <div
              key={d.label}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex w-full flex-1 items-end justify-center">
                <div
                  tabIndex={0}
                  className={
                    isNegative
                      ? "w-full max-w-8 rounded-t-md bg-rose-600/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:bg-rose-400/70 dark:focus-visible:outline-rose-400"
                      : "w-full max-w-8 rounded-t-md bg-indigo-500/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-indigo-400/70 dark:focus-visible:outline-indigo-400"
                  }
                  style={{
                    height: `${pct}%`,
                    // Non-colour differentiator for the sign, so a
                    // colourblind or monochrome-printing user can still tell
                    // a negative bar from a positive one.
                    backgroundImage: isNegative
                      ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 6px)"
                      : undefined,
                  }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                  {d.label}: {format(d.value)}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{`${title} — data`}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={`${d.label}-${d.value}`}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
