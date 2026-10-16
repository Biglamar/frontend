/**
 * DashboardShell.test.tsx (#275)
 *
 * Covers role-based nav-item selection (contributor/maintainer/sponsor each
 * get the correct set of links), the active-link highlighting logic (exact
 * match for /dashboard/* paths, prefix match for /issues, /milestones),
 * and the role-switcher section rendering the correct active role.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

const mockedUsePathname = usePathname as jest.Mock;

// Stub next/link to render a plain <a> so queries work in jsdom.
// `require("react")` (rather than a top-level import reference) is
// necessary here: jest.mock() factories are hoisted above imports and may
// only reference out-of-scope variables prefixed "mock", so this can't be
// rewritten as a normal ES import without breaking that hoisting contract.
jest.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return React.forwardRef(function Link(
    { href, children, ...rest }: { href: string; children?: React.ReactNode } & Record<string, unknown>,
    ref: React.Ref<HTMLAnchorElement>,
  ) {
    return <a href={href} ref={ref} {...rest}>{children}</a>;
  });
});

type Role = "contributor" | "maintainer" | "sponsor";

function shell(role: Role, pathname: string) {
  mockedUsePathname.mockReturnValue(pathname);
  return render(
    <DashboardShell role={role} title="Test Dashboard">
      <p>child content</p>
    </DashboardShell>,
  );
}

describe("DashboardShell — role-based nav items (#275)", () => {
  it("renders contributor nav items", () => {
    shell("contributor", "/dashboard/contributor");
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Browse bounties")).toBeInTheDocument();
    expect(screen.getByText("Reputation")).toBeInTheDocument();
  });

  it("renders maintainer nav items", () => {
    shell("maintainer", "/dashboard/maintainer");
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Bounty pipeline")).toBeInTheDocument();
    expect(screen.getByText("Milestones")).toBeInTheDocument();
  });

  it("renders sponsor nav items", () => {
    shell("sponsor", "/dashboard/sponsor");
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Bounties funded")).toBeInTheDocument();
    expect(screen.getByText("Milestones")).toBeInTheDocument();
  });

  it("does not render contributor-specific items for maintainer role", () => {
    shell("maintainer", "/dashboard/maintainer");
    expect(screen.queryByText("Browse bounties")).not.toBeInTheDocument();
    expect(screen.queryByText("Reputation")).not.toBeInTheDocument();
  });
});

describe("DashboardShell — active link highlighting", () => {
  it("highlights Overview when pathname matches exactly", () => {
    shell("contributor", "/dashboard/contributor");
    const overviewLink = screen.getByText("Overview").closest("a")!;
    expect(overviewLink.className).toContain("bg-indigo-50");
    expect(overviewLink.className).toContain("text-indigo-700");
  });

  it("does not highlight Overview on a nested route", () => {
    shell("contributor", "/dashboard/contributor/settings");
    const overviewLink = screen.getByText("Overview").closest("a")!;
    expect(overviewLink.className).not.toContain("bg-indigo-50");
  });

  it("highlights Browse bounties when on /issues", () => {
    shell("contributor", "/issues");
    const link = screen.getByText("Browse bounties").closest("a")!;
    expect(link.className).toContain("bg-indigo-50");
  });

  it("highlights Browse bounties on a nested /issues/* route", () => {
    shell("contributor", "/issues/abc-123");
    const link = screen.getByText("Browse bounties").closest("a")!;
    expect(link.className).toContain("bg-indigo-50");
  });

  it("does not highlight Browse bounties on an unrelated route", () => {
    shell("contributor", "/milestones");
    const link = screen.getByText("Browse bounties").closest("a")!;
    expect(link.className).not.toContain("bg-indigo-50");
  });
});

describe("DashboardShell — role switcher", () => {
  it("renders all three role options", () => {
    shell("contributor", "/dashboard/contributor");
    expect(screen.getByText("Contributor")).toBeInTheDocument();
    expect(screen.getByText("Maintainer")).toBeInTheDocument();
    expect(screen.getByText("Sponsor")).toBeInTheDocument();
  });

  it("bolds the current role in the switcher", () => {
    shell("maintainer", "/dashboard/maintainer");
    const maintainerLink = screen.getByText("Maintainer").closest("a")!;
    expect(maintainerLink.className).toContain("font-medium");
  });

  it("does not bold non-active roles", () => {
    shell("maintainer", "/dashboard/maintainer");
    const contributorLink = screen.getByText("Contributor").closest("a")!;
    expect(contributorLink.className).not.toContain("font-medium");
  });
});

describe("DashboardShell — content rendering", () => {
  it("renders the title and children", () => {
    shell("contributor", "/dashboard/contributor");
    expect(screen.getByText("Test Dashboard")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    mockedUsePathname.mockReturnValue("/dashboard/contributor");
    render(
      <DashboardShell role="contributor" title="Dashboard" subtitle="Welcome back">
        <p>child</p>
      </DashboardShell>,
    );
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });
});
