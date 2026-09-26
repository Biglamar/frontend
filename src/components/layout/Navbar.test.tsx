/**
 * Navbar.test.tsx (#276, #456)
 *
 * Covers the full auth × wallet state matrix the nav has to render honestly:
 *
 *   loading            → neutral skeleton, and *neither* the signed-in nor the
 *                        signed-out chrome (this was the flash bug: the
 *                        signed-out CTAs painted first on every load)
 *   signed out         → Sign in + Connect GitHub, no wallet chip
 *   signed in, 0 roles → dashboard menu explains roles are unassigned
 *   signed in, 1 role  → exactly that role's dashboard
 *   signed in, N roles → every held role, plus a count and an explanation
 *   wallet initializing→ skeleton, not a false "not connected"
 *   wallet none        → "link a wallet" affordance
 *   wallet local-only  → warning chip, visibly different from linked
 *   wallet linked      → confirmed chip with the truncated address
 */

import { render, screen } from "@testing-library/react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { Navbar } from "./Navbar";
import type { AuthUser } from "@/types";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/WalletContext", () => ({ useWallet: jest.fn() }));

jest.mock("@/components/ui/NetworkBadge", () => ({
  NetworkBadge: () => <span data-testid="network-badge" />,
}));
jest.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <span data-testid="theme-toggle" />,
}));
jest.mock("@/components/ui/Avatar", () => ({
  Avatar: ({ seed }: { seed: string }) => <span data-testid="avatar" data-seed={seed} />,
}));
jest.mock("next/link", () => {
  // `prefetch` is a next/link-only prop; spreading it onto a real <a> makes
  // React warn about an unknown DOM attribute. Dropped via `delete` rather
  // than destructuring so no unused binding is introduced.
  const Link = ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const anchorProps = { ...props } as Record<string, unknown>;
    delete anchorProps.prefetch;
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    );
  };
  return { __esModule: true, default: Link };
});

const mockedUseAuth = useAuth as jest.Mock;
const mockedUseWallet = useWallet as jest.Mock;

const BASE_USER: AuthUser = {
  id: "u1",
  username: "octocat",
  displayName: "The Octocat",
  avatarUrl: "https://example.com/avatar.png",
  roles: ["contributor"],
  stellarAddress: null,
};

function mockAuth(
  overrides: Partial<{ user: AuthUser | null; loading: boolean; logout: () => void }> = {},
) {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    logout: jest.fn(),
    ...overrides,
  });
}

function mockWallet(
  overrides: Partial<{
    address: string | null;
    linkState: "none" | "local" | "linked";
    initializing: boolean;
  }> = {},
) {
  mockedUseWallet.mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    initializing: false,
    addressMismatch: false,
    networkMismatch: false,
    linkState: "none",
    connect: jest.fn(),
    disconnect: jest.fn(),
    getError: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  mockAuth();
  mockWallet();
});

// ─── 1. Loading state: the flash bug (#456) ───────────────────────────────────

describe("Navbar — loading state renders a neutral skeleton", () => {
  it("shows a skeleton, not the signed-out CTAs, while the session resolves", () => {
    mockAuth({ user: null, loading: true });
    render(<Navbar />);

    expect(screen.getByTestId("navbar-session-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("does not show a phantom signed-in avatar while loading with no user yet", () => {
    // A session that will resolve to a real user must not paint the logged-out
    // chrome first, and must not paint a fake account either.
    mockAuth({ user: null, loading: true });
    render(<Navbar />);

    expect(screen.queryByTestId("avatar")).not.toBeInTheDocument();
    expect(screen.queryByText("The Octocat")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Sign out")).not.toBeInTheDocument();
  });

  it("marks the pending region busy and labels it for assistive tech", () => {
    mockAuth({ user: null, loading: true });
    render(<Navbar />);

    const skeleton = screen.getByTestId("navbar-session-skeleton");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveAccessibleName(/restoring your session/i);
  });

  it("reserves the same width as the signed-in content so the header does not jump", () => {
    mockAuth({ user: null, loading: true });
    render(<Navbar />);
    expect(screen.getByTestId("navbar-session-skeleton")).toHaveClass("w-32");
  });
});

// ─── 2. Signed out ──────────────────────────────────────────────────────────

describe("Navbar — signed out", () => {
  it("renders Connect GitHub and Sign in buttons", () => {
    render(<Navbar />);

    expect(screen.getByRole("button", { name: /connect github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("hides the Reputation link, sign-out button, and wallet chip", () => {
    render(<Navbar />);

    expect(screen.queryByText("Reputation")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Sign out")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/wallet/i)).not.toBeInTheDocument();
  });
});

// ─── 3. Signed in, single role ──────────────────────────────────────────────

describe("Navbar — signed in", () => {
  it("renders the display name and avatar", () => {
    mockAuth({ user: BASE_USER });
    render(<Navbar />);

    expect(screen.getByText("The Octocat")).toBeInTheDocument();
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-seed", "octocat");
  });

  it("falls back to username when displayName is null", () => {
    mockAuth({ user: { ...BASE_USER, displayName: null } });
    render(<Navbar />);

    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("renders the sign-out button and the Reputation link", () => {
    mockAuth({ user: BASE_USER });
    render(<Navbar />);

    expect(screen.getByTitle("Sign out")).toBeInTheDocument();
    expect(screen.getAllByText("Reputation").length).toBeGreaterThanOrEqual(1);
  });

  it("hides both signed-out CTAs", () => {
    mockAuth({ user: BASE_USER });
    render(<Navbar />);

    expect(screen.queryByRole("button", { name: /connect github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in$/i })).not.toBeInTheDocument();
  });
});

// ─── 4. Multi-role: the deliberate UX (#456) ────────────────────────────────

describe("Navbar — multi-role navigation", () => {
  it("lists every role the account actually holds, not just the first", () => {
    mockAuth({ user: { ...BASE_USER, roles: ["maintainer", "sponsor"] } });
    render(<Navbar />);

    // The single-role assumption this guards: a maintainer who also sponsors
    // used to be able to reach only one of their two dashboards from the nav.
    expect(screen.getByRole("link", { name: "Maintainer" })).toHaveAttribute(
      "href",
      "/dashboard/maintainer",
    );
    expect(screen.getByRole("link", { name: "Sponsor" })).toHaveAttribute(
      "href",
      "/dashboard/sponsor",
    );
  });

  it("does not list a role the account does not hold", () => {
    mockAuth({ user: { ...BASE_USER, roles: ["sponsor"] } });
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Sponsor" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Maintainer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contributor" })).not.toBeInTheDocument();
  });

  it("flags a multi-role account with a count and an explanation", () => {
    mockAuth({ user: { ...BASE_USER, roles: ["maintainer", "sponsor", "contributor"] } });
    render(<Navbar />);

    const trigger = screen.getByRole("button", { name: /dashboards/i });
    // Visible count in the trigger, so the number of dashboards is discoverable
    // without opening the menu.
    expect(trigger).toHaveTextContent("3");
    // Plus an explanation on hover/focus for *why* there are three.
    expect(trigger).toHaveAttribute("title", expect.stringContaining("You have 3 roles"));
  });

  it("does not show a count for a single-role account", () => {
    mockAuth({ user: { ...BASE_USER, roles: ["contributor"] } });
    render(<Navbar />);

    expect(screen.getByRole("button", { name: /^dashboards$/i })).not.toHaveTextContent("1");
  });

  it("explains the absence of dashboards when no role is assigned yet", () => {
    mockAuth({ user: { ...BASE_USER, roles: [] } });
    render(<Navbar />);

    expect(screen.getByText(/no dashboard assigned yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Maintainer" })).not.toBeInTheDocument();
  });

  it("de-duplicates and drops unknown role values from the backend payload", () => {
    // `roles` is cast straight off the API response with no validation, so a
    // malformed payload must not crash the nav or produce duplicate links.
    mockAuth({
      user: {
        ...BASE_USER,
        roles: ["sponsor", "sponsor", "admin" as never],
      },
    });
    render(<Navbar />);

    expect(screen.getAllByRole("link", { name: "Sponsor" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });
});

// ─── 5. Wallet state (#456) ─────────────────────────────────────────────────

describe("Navbar — wallet state", () => {
  it("shows a skeleton while the cached address is being read", () => {
    mockAuth({ user: BASE_USER });
    mockWallet({ initializing: true, address: null });
    render(<Navbar />);

    expect(screen.getByTestId("navbar-wallet-skeleton")).toBeInTheDocument();
    // Must not claim "not connected" during the hydration window.
    expect(screen.queryByTitle(/link a wallet/i)).not.toBeInTheDocument();
  });

  it("offers a link-a-wallet affordance when no wallet is connected", () => {
    mockAuth({ user: BASE_USER });
    render(<Navbar />);

    expect(screen.getByTitle("Link a wallet")).toHaveAttribute("href", "/connect");
  });

  it("marks a durably linked wallet as connected with its truncated address", () => {
    mockAuth({ user: BASE_USER });
    mockWallet({ address: "GABCDEFGH1234567890WXYZ", linkState: "linked" });
    render(<Navbar />);

    const chip = screen.getByTitle(/Wallet connected/);
    expect(chip).toHaveTextContent("GABC…WXYZ");
    expect(chip.className).not.toMatch(/amber/);
  });

  it("presents a browser-only connection as NOT linked, styled as a warning", () => {
    // The lie this guards: a wallet connected before GitHub sign-in is only a
    // local Freighter permission grant. Showing the same green chip as a
    // server-confirmed link told the user payouts could reach an address the
    // backend had never heard of.
    mockAuth({ user: { ...BASE_USER, stellarAddress: null } });
    mockWallet({ address: "GABCDEFGH1234567890WXYZ", linkState: "local" });
    render(<Navbar />);

    const chip = screen.getByTitle(/Wallet not linked/i);
    expect(chip.className).toMatch(/amber/);
    expect(screen.queryByTitle(/Wallet connected/)).not.toBeInTheDocument();
  });
});
