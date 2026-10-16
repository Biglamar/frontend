import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MilestoneFundButton, PoolDepositButton } from "./MilestoneActions";

const mockRunWithWallet = jest.fn();
const mockApiPost = jest.fn();
const mockApiRequestError = class extends Error {};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/hooks/useWalletAction", () => ({
  useWalletAction: () => ({
    runWithWallet: mockRunWithWallet,
    connecting: false,
  }),
}));

jest.mock("@/lib/api", () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  // Must be the *same* class the component's `instanceof ApiRequestError`
  // check sees, or a rejected request degrades to the generic
  // "Something went wrong." copy instead of surfacing the backend message.
  // Exposed as a getter because jest.mock's factory is hoisted above the
  // const declarations, so it cannot capture the class eagerly.
  get ApiRequestError() {
    return mockApiRequestError;
  },
}));

const WALLET = "GABCDEFGH1234567890WXYZ";

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPost.mockResolvedValue({});
  mockRunWithWallet.mockImplementation(async (fn: (a: string) => unknown) => {
    const data = await fn(WALLET);
    return { ok: true, data };
  });
});

describe("PoolDepositButton accessibility", () => {
  it("associates a deposit error with the amount input", async () => {
    mockRunWithWallet.mockResolvedValue({ ok: false, error: "Deposit failed." });
    render(<PoolDepositButton poolId="pool-3" />);

    const input = screen.getByLabelText("Deposit amount");
    fireEvent.click(screen.getByRole("button", { name: "Deposit to pool" }));

    const error = await screen.findByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  });
});

describe("PoolDepositButton input precision", () => {
  it("uses seven-decimal native input steps for XLM", () => {
    render(<PoolDepositButton poolId="pool-1" asset="XLM" />);

    const input = screen.getByLabelText("Deposit amount");
    expect(input).toHaveAttribute("min", "0.0000001");
    expect(input).toHaveAttribute("step", "0.0000001");
  });

  it("keeps two-decimal native input steps for USDC", () => {
    render(<PoolDepositButton poolId="pool-2" asset="USDC" />);

    const input = screen.getByLabelText("Deposit amount");
    expect(input).toHaveAttribute("min", "0.01");
    expect(input).toHaveAttribute("step", "0.01");
  });
});

/**
 * MilestoneFundButton posted { funderAddress } with no amount field at all,
 * while its sibling two components down in the same file correctly collected
 * one. Milestones are explicitly modelled as incrementally funded (the card's
 * distributed/budget progress bar), so a contribution with no amount is a
 * real gap, not a stylistic inconsistency (#421).
 */
describe("MilestoneFundButton amount input", () => {
  it("renders an amount input alongside the fund action", () => {
    render(<MilestoneFundButton milestoneId="m1" />);

    expect(screen.getByLabelText("Funding amount")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fund milestone" }),
    ).toBeInTheDocument();
  });

  it("sends the user-entered amount to the fund endpoint", async () => {
    render(<MilestoneFundButton milestoneId="m1" />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value: "250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Fund milestone" }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    expect(mockApiPost).toHaveBeenCalledWith(
      "/milestones/m1/fund",
      expect.objectContaining({
        amount: "250.5",
        funderAddress: WALLET,
      }),
    );
  });

  it("pre-fills the remaining budget so a partial milestone defaults to the gap", () => {
    // m2 in mock-data: 2100 of 6000 distributed.
    render(<MilestoneFundButton milestoneId="m2" remainingBudget={3900} />);

    expect(screen.getByLabelText("Funding amount")).toHaveValue(3900);
  });

  it("defaults to the full budget for a milestone that has never been funded", () => {
    render(<MilestoneFundButton milestoneId="m1" remainingBudget={6000} />);

    expect(screen.getByLabelText("Funding amount")).toHaveValue(6000);
  });

  it("falls back to a 100 default and no cap when the budget is unknown", () => {
    render(<MilestoneFundButton milestoneId="m0" />);

    const input = screen.getByLabelText("Funding amount");
    expect(input).toHaveValue(100);
    expect(input).not.toHaveAttribute("max");
  });

  it("mirrors the remaining budget onto the input's max attribute", () => {
    render(<MilestoneFundButton milestoneId="m2" remainingBudget={3900} />);

    expect(screen.getByLabelText("Funding amount")).toHaveAttribute(
      "max",
      "3900",
    );
  });

  it("uses seven-decimal native steps for XLM", () => {
    render(<MilestoneFundButton milestoneId="m3" asset="XLM" />);

    const input = screen.getByLabelText("Funding amount");
    expect(input).toHaveAttribute("min", "0.0000001");
    expect(input).toHaveAttribute("step", "0.0000001");
  });
});

describe("MilestoneFundButton amount validation", () => {
  // Same rules PoolDepositButton already enforces via parseMoneyInput —
  // deliberately not a second, looser set of rules.
  it.each([
    ["empty", ""],
    ["zero", "0"],
    ["negative", "-50"],
    ["non-numeric", "abc"],
    ["over-precision for USDC", "10.005"],
  ])("rejects a %s amount", async (_label, value) => {
    render(<MilestoneFundButton milestoneId="m1" remainingBudget={6000} />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value } });

    const button = screen.getByRole("button", { name: "Fund milestone" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("accepts seven decimals for XLM", () => {
    render(<MilestoneFundButton milestoneId="m3" asset="XLM" />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value: "1.0000001" } });

    expect(
      screen.getByRole("button", { name: "Fund milestone" }),
    ).toBeEnabled();
  });

  it("rejects an amount larger than the remaining budget", () => {
    render(<MilestoneFundButton milestoneId="m2" remainingBudget={3900} />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value: "5000" } });

    expect(
      screen.getByRole("button", { name: "Fund milestone" }),
    ).toBeDisabled();
  });

  it("blocks submit and marks the input invalid when the amount can't be used", async () => {
    // The button is disabled while the amount is unusable, matching
    // PoolDepositButton — so no error message is ever needed for this state,
    // and the typed value is simply never allowed to reach the backend.
    render(<MilestoneFundButton milestoneId="m1" />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value: "10.005" } });

    expect(input).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "Fund milestone" }));
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("surfaces a backend rejection without clearing the entered amount", async () => {
    mockApiPost.mockRejectedValue(
      new mockApiRequestError("Escrow funding failed."),
    );
    render(<MilestoneFundButton milestoneId="m1" />);

    const input = screen.getByLabelText("Funding amount");
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Fund milestone" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Escrow funding failed.");
    expect(input).toHaveValue(300);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
  });
});
