import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { BarChart } from "@/components/ui/BarChart";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

expect.extend(toHaveNoViolations);

/**
 * Composition-level accessibility audit for the two hand-rolled chart
 * primitives as they actually appear on the dashboards: a heading, a Card, a
 * StatCard-with-sparkline row, and a BarChart.
 *
 * The dashboard pages themselves are client components that fetch on mount, so
 * this renders the same card composition they do rather than mounting the
 * whole page — the charts are the part this audit is about, and axe on the
 * composition catches the region/heading/landmark rules the charts introduce.
 */
const SPEND = [
  { label: "W1", value: 420 },
  { label: "W2", value: -75 },
  { label: "W3", value: 910 },
  { label: "W4", value: 655 },
];

function DashboardCharts() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
        Dashboard
      </h1>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Lifetime earnings"
          value={8420}
          format="currency"
          sparkline={[12, 18, 14, 22, 19, 27, 24, 31]}
        />
        <StatCard label="Merged PRs" value={61} format="count" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-slate-900 dark:text-white">
            Spend, last 8 weeks
          </h2>
          <div className="mt-6">
            <BarChart
              data={SPEND}
              formatValue={(v) => formatCurrency(v)}
              title="Spend, last 8 weeks"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

describe("dashboard chart composition — automated audit", () => {
  it("has no critical or serious violations", async () => {
    const { container } = render(<DashboardCharts />);

    const results = await axe(container);
    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking).toEqual([]);
    expect(results).toHaveNoViolations();
  });

  it("offers the chart data and trend as text a screen reader can reach", () => {
    render(<DashboardCharts />);

    // Both the categorical chart and the trend line are readable as text.
    expect(
      screen.getByRole("table", { name: /Spend, last 8 weeks — data/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("Lifetime earnings"),
    );
  });

  it("keeps the negative value signed in the data table", () => {
    render(<DashboardCharts />);

    expect(screen.getByRole("row", { name: /W2/ })).toHaveTextContent("-75");
  });
});
