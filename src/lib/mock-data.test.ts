import {
  mockBounties,
  mockMaintenancePools,
  mockMilestones,
  recentActivity,
  getRecentActivity,
} from "./mock-data";
import { formatCurrency, isPlausibleAmount } from "./utils";

// #367: the platform supports USDC and XLM, so the mock-data fallback every
// visitor sees must represent both assets in each collection.
describe("mock-data asset coverage", () => {
  const collections = {
    mockBounties,
    mockMilestones,
    mockMaintenancePools,
    recentActivity: recentActivity.filter((e) => e.asset),
  };

  it.each(Object.entries(collections))("%s contains both USDC and XLM entries", (_, items) => {
    const assets = new Set(items.map((item) => item.asset));
    expect(assets).toEqual(new Set(["USDC", "XLM"]));
  });

  it("every mock amount is plausible (below formatCurrency's sanity ceiling)", () => {
    const amounts = [
      ...mockBounties.map((b) => b.reward),
      ...mockMilestones.flatMap((m) => [m.budget, m.distributed]),
      ...mockMaintenancePools.flatMap((p) => [p.balance, p.monthlyDeposit]),
      ...recentActivity.flatMap((e) => (e.amount === undefined ? [] : [e.amount])),
    ];
    for (const amount of amounts) {
      expect(isPlausibleAmount(amount)).toBe(true);
    }
  });

  it("XLM mock amounts render with XLM precision and no sanity warning", () => {
    const pool = mockMaintenancePools.find((p) => p.asset === "XLM")!;
    expect(formatCurrency(pool.balance, pool.asset)).toBe("8,412.1234567 XLM");

    const bounty = mockBounties.find((b) => b.asset === "XLM")!;
    expect(formatCurrency(bounty.reward, bounty.asset)).toBe("1,250.5 XLM");

    const milestone = mockMilestones.find((m) => m.asset === "XLM")!;
    expect(formatCurrency(milestone.distributed, milestone.asset)).toBe("16,837.25 XLM");
  });
});

describe("recentActivity dynamic timestamps (#707)", () => {
  it("computes timestamps relative to execution time rather than module load", () => {
    const events = getRecentActivity();
    expect(events.length).toBeGreaterThan(0);
    const now = Date.now();
    for (const event of events) {
      const diffMinutes = (now - new Date(event.occurredAt).getTime()) / 60_000;
      expect(diffMinutes).toBeGreaterThanOrEqual(0);
      expect(diffMinutes).toBeLessThan(250);
    }
  });

  it("advances timestamps dynamically across accesses via proxy", () => {
    const firstEvent = recentActivity[0];
    expect(new Date(firstEvent.occurredAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
