import { fireEvent, render, screen } from "@testing-library/react";
import { PoolDepositButton } from "./MilestoneActions";

const mockRunWithWallet = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/hooks/useWalletAction", () => ({
  useWalletAction: () => ({
    runWithWallet: mockRunWithWallet,
    connecting: false,
  }),
}));

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
