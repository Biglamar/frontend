import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueActions } from "./IssueActions";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { apiPost, ApiRequestError } from "@/lib/api";
import type { Bounty, BountyStatus } from "@/types";

const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiPost: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const connect = jest.fn();

function makeBounty(
  status: BountyStatus,
  overrides: Partial<Bounty> = {},
): Bounty {
  return {
    id: "bounty-1",
    title: "Fix the thing",
    description: "",
    reward: 250,
    asset: "USDC",
    difficulty: "beginner",
    status,
    org: "mergefi",
    repo: "frontend",
    issueNumber: 1,
    labels: [],
    deadline: null,
    // The status table below reads as "what the sponsor sees" — refund is
    // only ever rendered to this account. Gating itself is covered separately.
    sponsorId: "user-1",
    ...overrides,
  } as Bounty;
}

function mockWallet(overrides: Record<string, unknown> = {}) {
  mockUseWallet.mockReturnValue({
    address: "GWALLET",
    connect,
    connecting: false,
    addressMismatch: false,
    networkMismatch: false,
    recheckNetworkMismatch: jest.fn().mockResolvedValue(false),
    getError: () => null,
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

function mockUser(
  user: { id: string; stellarAddress?: string | null } | null = {
    id: "user-1",
    stellarAddress: "GSTELLAR",
  },
) {
  mockUseAuth.mockReturnValue({ user } as unknown as ReturnType<
    typeof useAuth
  >);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWallet();
  mockUser();
  // Claim consumes `{ data: bounty }` on success; every other endpoint here
  // returns a body the handler ignores.
  mockApiPost.mockImplementation((async (path: string) =>
    path.endsWith("/claim") ? { data: makeBounty("claimed") } : undefined) as never);
});

describe("IssueActions — action buttons per bounty.status", () => {
  const buttonNames = () =>
    screen.queryAllByRole("button").map((b) => b.textContent);

  it("open → only 'Fund this bounty'", () => {
    render(<IssueActions bounty={makeBounty("open")} />);
    expect(buttonNames()).toEqual(["Fund this bounty"]);
  });

  it("funded → 'Claim Bounty' and 'Refund sponsor'", () => {
    render(<IssueActions bounty={makeBounty("funded")} />);
    expect(buttonNames()).toEqual(["Claim Bounty", "Refund sponsor"]);
  });

  it("claimed → only 'Refund sponsor' (no second claim)", () => {
    render(<IssueActions bounty={makeBounty("claimed")} />);
    expect(buttonNames()).toEqual(["Refund sponsor"]);
  });

  it.each([
    ["in_review", "Awaiting PR merge"],
    ["merged", "Payout pending"],
    ["paid", "Payout complete"],
    ["refunded", "No action available"],
    ["expired", "No action available"],
  ] as const)(
    "%s → a single disabled '%s' button and no money-moving action",
    (status, label) => {
      render(<IssueActions bounty={makeBounty(status)} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent(label);
      expect(buttons[0]).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: /fund|claim|refund/i }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("IssueActions — fund (wallet-gated)", () => {
  it("funds with the connected wallet address, shows a notice and refreshes", async () => {
    const user = userEvent.setup();
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(mockApiPost).toHaveBeenCalledWith(
      "/bounties/bounty-1/fund",
      expect.objectContaining({
        funderAddress: "GWALLET",
        idempotencyKey: expect.any(String),
      }),
    );
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/Escrow funded on-chain/);
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("connects first when no wallet is connected", async () => {
    const user = userEvent.setup();
    connect.mockResolvedValueOnce("GNEWWALLET");
    mockWallet({ address: null });
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(connect).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      "/bounties/bounty-1/fund",
      expect.objectContaining({ funderAddress: "GNEWWALLET" }),
    );
  });

  it("blocks funding when addressMismatch is set — no connect, no apiPost, error shown", async () => {
    const user = userEvent.setup();
    mockWallet({ addressMismatch: true });
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /active account has changed/,
    );
    expect(connect).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("blocks funding when a live network re-check still reports a mismatch", async () => {
    const user = userEvent.setup();
    mockWallet({
      networkMismatch: true,
      recheckNetworkMismatch: jest.fn().mockResolvedValue(true),
    });
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/wrong network/);
    expect(connect).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  // The mount-time flag used to be authoritative: a user who fixed the
  // network inside Freighter stayed locked out until a full page reload.
  it("funds normally once the re-check finds the network corrected", async () => {
    const user = userEvent.setup();
    mockWallet({
      networkMismatch: true,
      recheckNetworkMismatch: jest.fn().mockResolvedValue(false),
    });
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Escrow funded/);
    expect(mockApiPost).toHaveBeenCalledWith(
      "/bounties/bounty-1/fund",
      expect.objectContaining({ funderAddress: "GWALLET" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the connect error when the wallet connection is declined", async () => {
    const user = userEvent.setup();
    connect.mockResolvedValueOnce(null);
    mockWallet({ address: null });
    render(<IssueActions bounty={makeBounty("open")} />);
    await user.click(screen.getByRole("button", { name: "Fund this bounty" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connect a Stellar wallet to continue.",
    );
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe("IssueActions — claim", () => {
  it("redirects signed-out users to /connect without calling the API", async () => {
    const user = userEvent.setup();
    mockUser(null);
    render(<IssueActions bounty={makeBounty("funded")} />);
    await user.click(screen.getByRole("button", { name: "Claim Bounty" }));

    expect(push).toHaveBeenCalledWith("/connect");
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("claims as the signed-in user and shows a notice", async () => {
    const user = userEvent.setup();
    render(<IssueActions bounty={makeBounty("funded")} />);
    await user.click(screen.getByRole("button", { name: "Claim Bounty" }));

    // The contributor identity is taken from the JWT server-side, so the
    // body carries nothing — not even a client-asserted contributorId.
    expect(mockApiPost).toHaveBeenCalledWith("/bounties/bounty-1/claim", {});
    expect(await screen.findByRole("status")).toHaveTextContent(
      /You've claimed this issue/,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("claims are blocked outright when the user has no payout wallet", () => {
    mockUser({ id: "user-1", stellarAddress: null });
    render(<IssueActions bounty={makeBounty("funded")} />);

    expect(
      screen.queryByRole("button", { name: "Claim Bounty" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Add a payout wallet/i);
    expect(screen.getByRole("link", { name: "Connect a wallet" })).toHaveAttribute(
      "href",
      "/connect",
    );
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders the API error message in a role=alert", async () => {
    const user = userEvent.setup();
    mockApiPost.mockRejectedValueOnce(
      new ApiRequestError("Bounty is not funded", 400),
    );
    render(<IssueActions bounty={makeBounty("funded")} />);
    await user.click(screen.getByRole("button", { name: "Claim Bounty" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bounty is not funded",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the failure message for non-API errors", async () => {
    const user = userEvent.setup();
    mockApiPost.mockRejectedValueOnce(new Error("socket hang up"));
    render(<IssueActions bounty={makeBounty("funded")} />);
    await user.click(screen.getByRole("button", { name: "Claim Bounty" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("socket hang up");
  });
});

describe("IssueActions — refund (confirm-gated)", () => {
  let confirmSpy: jest.SpyInstance;
  beforeEach(() => {
    confirmSpy = jest.spyOn(window, "confirm");
  });
  afterEach(() => confirmSpy.mockRestore());

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(false);
    render(<IssueActions bounty={makeBounty("funded")} />);
    await user.click(screen.getByRole("button", { name: "Refund sponsor" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for confirmation with the amount, then refunds once confirmed", async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(true);
    render(<IssueActions bounty={makeBounty("claimed")} />);
    await user.click(screen.getByRole("button", { name: "Refund sponsor" }));

    expect(confirmSpy.mock.calls[0][0]).toMatch(/cannot be undone/);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/250/);
    expect(mockApiPost).toHaveBeenCalledWith(
      "/bounties/bounty-1/refund",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(confirmSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockApiPost.mock.invocationCallOrder[0],
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      /refunded to the sponsor/,
    );
  });
});

describe("IssueActions — refund is offered to the funder only", () => {
  const refundButton = () =>
    screen.queryByRole("button", { name: "Refund sponsor" });

  it("is never offered to a signed-out reader", () => {
    mockUser(null);
    render(<IssueActions bounty={makeBounty("funded")} />);

    expect(refundButton()).not.toBeInTheDocument();
    // Claiming stays open — it is not the sponsor's action to restrict.
    expect(screen.getByRole("button", { name: "Claim Bounty" })).toBeInTheDocument();
  });

  it("is never offered to a signed-in user who did not fund this bounty", () => {
    mockUser({ id: "someone-else", stellarAddress: "GOTHER" });
    render(<IssueActions bounty={makeBounty("claimed")} />);

    expect(refundButton()).not.toBeInTheDocument();
    // Nothing else is actionable on a claimed bounty for a non-sponsor, so
    // the action row renders empty rather than offering a misleading control.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("is withheld when the bounty carries no sponsor identity to compare against", () => {
    render(<IssueActions bounty={makeBounty("funded", { sponsorId: undefined })} />);

    expect(refundButton()).not.toBeInTheDocument();
  });

  it("is offered to the funder, who is the only account that can use it", () => {
    mockUser({ id: "user-1", stellarAddress: "GSTELLAR" });
    render(
      <IssueActions bounty={makeBounty("funded", { sponsorId: "user-1" })} />,
    );

    expect(refundButton()).toBeInTheDocument();
  });
});
