/**
 * EmptyState.test.tsx (#456)
 *
 * The component was previously a single undifferentiated grey box reused
 * verbatim at every call site, with no tests at all. These cover the variant
 * API that lets each call site declare *which kind* of empty it is, plus the
 * a11y fixes (real heading, optional icon, action/secondary-action slots).
 */

import { render, screen } from "@testing-library/react";
import { Inbox, CheckCircle2 } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState — required content", () => {
  it("renders the title and description", () => {
    render(<EmptyState icon={Inbox} title="Nothing here" description="Yet." />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Yet.")).toBeInTheDocument();
  });

  it("renders the title as a real heading so it is reachable by SR navigation", () => {
    // It used to be a bare <p>, which left empty states invisible to
    // heading-rotation navigation.
    render(<EmptyState icon={Inbox} title="Nothing here" description="Yet." />);

    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
  });

  it("honours an explicit heading level", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nothing here" description="Yet." headingLevel="h2" />,
    );

    expect(container.querySelector("h2")).toBeInTheDocument();
    expect(container.querySelector("h3")).not.toBeInTheDocument();
  });

  it("renders no action area when no action is supplied", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nothing here" description="Yet." />,
    );

    // 4 of the 6 original call sites had no CTA at all.
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState — optional icon", () => {
  it("renders the icon when supplied", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nothing" description="Yet." />,
    );

    expect(container.querySelector(".lucide-inbox")).toBeInTheDocument();
  });

  it("renders without an icon rather than reserving empty space", () => {
    const { container } = render(<EmptyState title="Nothing" description="Yet." />);

    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
});

describe("EmptyState — actions", () => {
  it("renders a primary action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing"
        description="Yet."
        action={<button>Fund a bounty</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Fund a bounty" })).toBeInTheDocument();
  });

  it("renders a secondary action alongside the primary", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing"
        description="Yet."
        action={<button>Primary</button>}
        secondaryAction={<button>Secondary</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondary" })).toBeInTheDocument();
  });

  it("renders a secondary action with no primary action", () => {
    render(
      <EmptyState
        icon={CheckCircle2}
        title="All caught up"
        description="Nothing to review."
        secondaryAction={<button>Review open bounties</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Review open bounties" })).toBeInTheDocument();
  });
});

describe("EmptyState — tone differentiates situation from situation", () => {
  // The whole point of `tone`: "the platform has nothing" and "you finished
  // everything" must not render as the same visual event.
  it("gives each tone a distinct visual treatment", () => {
    const tones = ["neutral", "success", "info", "warning"] as const;
    const classNames = tones.map((tone) => {
      const { container, unmount } = render(
        <EmptyState icon={Inbox} title="T" description="D" tone={tone} />,
      );
      const shell = container.firstElementChild as HTMLElement;
      const result = shell.className;
      unmount();
      return result;
    });

    expect(new Set(classNames).size).toBe(tones.length);
  });

  it("styles a success empty differently from a neutral one", () => {
    const { container: success } = render(
      <EmptyState icon={CheckCircle2} title="All settled" description="D" tone="success" />,
    );
    const { container: neutral } = render(
      <EmptyState icon={Inbox} title="Nothing yet" description="D" tone="neutral" />,
    );

    expect((success.firstElementChild as HTMLElement).className).toMatch(/emerald/);
    expect((neutral.firstElementChild as HTMLElement).className).not.toMatch(/emerald/);
  });

  it("defaults to the neutral tone", () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" description="D" />);

    expect((container.firstElementChild as HTMLElement).className).toMatch(/bg-slate-50\/50/);
  });
});

describe("EmptyState — size and className", () => {
  it("renders a more compact list-level empty at size=sm", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="T" description="D" size="sm" />,
    );

    expect((container.firstElementChild as HTMLElement).className).toMatch(/py-8/);
  });

  it("renders the page-level empty at the default size", () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" description="D" />);

    expect((container.firstElementChild as HTMLElement).className).toMatch(/py-12/);
  });

  it("lets a caller span the empty state across a grid", () => {
    // Both /milestones empty states sat in an md:grid-cols-2 container and
    // rendered at half width.
    const { container } = render(
      <EmptyState icon={Inbox} title="T" description="D" className="md:col-span-2" />,
    );

    expect((container.firstElementChild as HTMLElement).className).toMatch(/md:col-span-2/);
  });
});

describe("EmptyState — pass-through props", () => {
  it("forwards role and aria attributes to the container", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="T" description="D" role="status" aria-live="polite" />,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell).toHaveAttribute("role", "status");
    expect(shell).toHaveAttribute("aria-live", "polite");
  });
});
