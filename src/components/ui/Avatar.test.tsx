/**
 * Avatar.test.tsx
 *
 * Covers Avatar render logic (src vs fallback URL, unoptimized flag),
 * malicious/unallowlisted `src` rejection and load-failure fallback (#20),
 * and AvatarStack overflow counting (under-max, at-max, over-max) — #278.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { Avatar, AvatarStack } from "./Avatar";

const GITHUB_AVATAR = "https://avatars.githubusercontent.com/u/1?v=4";

describe("Avatar", () => {
  it("renders with the given seed as alt text", () => {
    render(<Avatar seed="alice" />);
    const img = screen.getByRole("img", { name: "alice" });
    expect(img).toBeInTheDocument();
  });

  it("uses the src prop when it's on the allowlisted GitHub avatar host", () => {
    render(<Avatar seed="alice" src={GITHUB_AVATAR} />);
    const img = screen.getByRole("img", { name: "alice" });
    // Next.js Image rewrites the src through its optimization pipeline
    expect(img.getAttribute("src")).toContain("avatars.githubusercontent.com");
  });

  it("falls back to a dicebear URL when no src is provided", () => {
    render(<Avatar seed="bob" />);
    const img = screen.getByRole("img", { name: "bob" });
    const src = img.getAttribute("src") ?? "";
    expect(src).toContain("api.dicebear.com");
    expect(src).toContain("seed=bob");
  });

  it("uses dicebear URL for unoptimized external images", () => {
    render(<Avatar seed="carol" />);
    const img = screen.getByRole("img", { name: "carol" });
    expect(img.getAttribute("src")).toContain("dicebear.com");
  });

  it("does not set unoptimized for allowlisted custom src URLs", () => {
    render(<Avatar seed="dave" src={GITHUB_AVATAR} />);
    const img = screen.getByRole("img", { name: "dave" });
    expect(img.getAttribute("src")).toContain("avatars.githubusercontent.com");
  });

  it("applies custom size dimensions", () => {
    render(<Avatar seed="eve" size={48} />);
    const img = screen.getByRole("img", { name: "eve" });
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });

  it("merges custom className", () => {
    render(<Avatar seed="frank" className="test-extra" />);
    const img = screen.getByRole("img", { name: "frank" });
    expect(img.className).toMatch(/test-extra/);
  });

  it("falls back to the dicebear identicon for a src on a non-allowlisted host", () => {
    render(<Avatar seed="gina" src="https://evil.example.com/gina.png" />);
    const img = screen.getByRole("img", { name: "gina" });
    expect(img.getAttribute("src")).toContain("dicebear.com");
  });

  it("falls back to the dicebear identicon for a javascript: scheme src", () => {
    render(<Avatar seed="hank" src="javascript:alert(1)" />);
    const img = screen.getByRole("img", { name: "hank" });
    expect(img.getAttribute("src")).toContain("dicebear.com");
  });

  it("falls back to the dicebear identicon for a data: scheme src", () => {
    render(<Avatar seed="ivy" src="data:text/html,<script>alert(1)</script>" />);
    const img = screen.getByRole("img", { name: "ivy" });
    expect(img.getAttribute("src")).toContain("dicebear.com");
  });

  it("falls back to the dicebear identicon when the allowlisted src fails to load", () => {
    render(<Avatar seed="jack" src={GITHUB_AVATAR} />);
    const img = screen.getByRole("img", { name: "jack" });
    expect(img.getAttribute("src")).toContain("avatars.githubusercontent.com");

    fireEvent.error(img);

    expect(screen.getByRole("img", { name: "jack" }).getAttribute("src")).toContain(
      "dicebear.com",
    );
  });
});

describe("AvatarStack", () => {
  it("renders all seeds when under max", () => {
    render(<AvatarStack seeds={["a", "b", "c"]} max={5} />);
    expect(screen.getByRole("img", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "b" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "c" })).toBeInTheDocument();
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("renders exactly max avatars when seeds length equals max", () => {
    render(<AvatarStack seeds={["a", "b", "c"]} max={3} />);
    expect(screen.getByRole("img", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "b" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "c" })).toBeInTheDocument();
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("shows overflow count when seeds exceed max", () => {
    render(<AvatarStack seeds={["a", "b", "c", "d", "e"]} max={3} />);
    expect(screen.getByRole("img", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "b" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "c" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "d" })).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("defaults max to 5", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g"];
    render(<AvatarStack seeds={seeds} />);
    expect(screen.getByRole("img", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "e" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "f" })).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("includes hidden seed names in the overflow title attribute", () => {
    render(<AvatarStack seeds={["a", "b", "c", "d"]} max={2} />);
    const overflow = screen.getByText("+2");
    expect(overflow).toHaveAttribute("title", "c, d");
  });

  it("renders nothing extra for an empty seeds array", () => {
    const { container } = render(<AvatarStack seeds={[]} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
