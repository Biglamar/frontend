import { render, screen } from "@testing-library/react";
import { fetchMaintenancePools, fetchMilestones } from "@/lib/api";
import type { Milestone } from "@/types";
import MilestonesPage from "./page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/hooks/useWalletAction", () => ({
  useWalletAction: () => ({ runWithWallet: jest.fn(), connecting: false }),
}));
jest.mock("@/lib/api", () => ({
  fetchMilestones: jest.fn(),
  fetchMaintenancePools: jest.fn(),
}));

const mockFetchMilestones = fetchMilestones as jest.MockedFunction<typeof fetchMilestones>;
const mockFetchPools = fetchMaintenancePools as jest.MockedFunction<typeof fetchMaintenancePools>;

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "m1",
    name: "v2.0 release",
    repo: "acme/widgets",
    budget: 6000,
    distributed: 2100,
    asset: "USDC",
    issueCount: 5,
    completedCount: 2,
    ...overrides,
  };
}

async function renderPage(milestones: Milestone[]) {
  mockFetchMilestones.mockResolvedValue({ data: milestones, source: "mock" });
  mockFetchPools.mockResolvedValue({ data: [], source: "mock" });
  render(await MilestonesPage());
}

/**
 * The fund form's amount default and cap both come from budget - distributed,
 * computed on this page. A milestone that has never been funded (distributed:
 * 0) must still get a usable, enabled form rather than being capped at zero.
 */
describe("MilestonesPage — remaining budget wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("caps a partially funded milestone at its remaining budget", async () => {
    await renderPage([makeMilestone()]);

    // 6000 - 2100 = 3900
    const input = screen.getByLabelText("Funding amount");
    expect(input).toHaveValue(3900);
    expect(input).toHaveAttribute("max", "3900");
  });

  it("offers the full budget for a milestone funded for the first time", async () => {
    await renderPage([makeMilestone({ distributed: 0 })]);

    const input = screen.getByLabelText("Funding amount");
    expect(input).toHaveValue(6000);
    expect(
      screen.getByRole("button", { name: /Fund milestone/ }),
    ).toBeEnabled();
  });

  it("leaves a budget-less milestone uncapped rather than capping it at zero", async () => {
    await renderPage([makeMilestone({ budget: 0, distributed: 0 })]);

    const input = screen.getByLabelText("Funding amount");
    expect(input).not.toHaveAttribute("max");
    expect(input).toHaveValue(100);
    expect(
      screen.getByRole("button", { name: /Fund milestone/ }),
    ).toBeEnabled();
  });

  it("passes the milestone's asset through to the amount step", async () => {
    await renderPage([makeMilestone({ asset: "XLM" })]);

    const input = screen.getByLabelText("Funding amount");
    expect(input).toHaveAttribute("step", "0.0000001");
  });
});
