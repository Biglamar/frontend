/**
 * Button.test.tsx (#211)
 *
 * Covers the `loading` prop: it should set aria-busy, force disabled
 * (even when `disabled` isn't separately passed), and render a spinner —
 * standardizing the pattern every async-action call site previously
 * reimplemented independently with no aria-busy at all.
 */

import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button — loading prop", () => {
  it("is not busy or disabled by default", () => {
    render(<Button>Fund this bounty</Button>);
    const button = screen.getByRole("button", { name: "Fund this bounty" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toBeDisabled();
  });

  it("sets aria-busy and disables the button when loading", () => {
    render(<Button loading>Confirming in wallet...</Button>);
    const button = screen.getByRole("button", { name: /Confirming in wallet/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("renders a spinner when loading", () => {
    const { container } = render(<Button loading>Claiming...</Button>);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders no spinner when not loading", () => {
    const { container } = render(<Button>Claim this issue</Button>);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("stays disabled when explicitly disabled, independent of loading", () => {
    render(<Button disabled>No action available</Button>);
    const button = screen.getByRole("button", { name: "No action available" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

describe("Button — variant prop", () => {
  it("applies primary variant classes by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button.className).toContain("bg-slate-900");
    expect(button.className).toContain("text-white");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button.className).toContain("bg-indigo-50");
    expect(button.className).toContain("text-indigo-700");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("text-slate-600");
  });

  it("applies outline variant classes", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button", { name: "Outline" });
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-slate-200");
  });
});

describe("Button — size prop", () => {
  it("applies md size classes by default", () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole("button", { name: "Medium" });
    expect(button.className).toContain("px-4");
    expect(button.className).toContain("py-2");
    expect(button.className).toContain("text-sm");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole("button", { name: "Small" });
    expect(button.className).toContain("px-3");
    expect(button.className).toContain("py-1.5");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole("button", { name: "Large" });
    expect(button.className).toContain("px-6");
    expect(button.className).toContain("py-3");
    expect(button.className).toContain("text-base");
  });
});
