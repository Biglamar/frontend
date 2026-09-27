/**
 * Tests for BountyDescription (#89).
 *
 * bounty.description is raw, untrusted, third-party GitHub issue Markdown
 * with no backend sanitization guaranteed anywhere in this pipeline. These
 * tests cover both halves of the issue: (a) real GFM content renders as
 * actual formatted elements, not raw syntax, and (b) HTML/script injection
 * attempts embedded in that markdown render completely inertly.
 */

import { render, screen } from "@testing-library/react";
import { BountyDescription } from "./BountyDescription";

describe("BountyDescription — content fidelity", () => {
  it("renders a fenced code block as a <pre><code> element, not raw ``` syntax", () => {
    const description = "Steps:\n```js\nconst x = getBalance();\n```";
    render(<BountyDescription description={description} />);

    expect(screen.queryByText(/```/)).not.toBeInTheDocument();
    const code = screen.getByText((content) =>
      content.includes("getBalance()"),
    );
    expect(code.tagName.toLowerCase()).toBe("code");
    expect(code.closest("pre")).toBeInTheDocument();
  });

  it("renders a markdown link as a real <a> element with the correct href", () => {
    render(
      <BountyDescription description="See [the docs](https://example.com/docs) for details." />,
    );

    const link = screen.getByRole("link", { name: "the docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    // Raw markdown link syntax must not appear literally in the output.
    expect(screen.queryByText(/\[the docs\]/)).not.toBeInTheDocument();
  });

  it("renders bold text as a <strong> element, not literal asterisks", () => {
    render(<BountyDescription description="This is **important** context." />);

    const strong = screen.getByText("important");
    expect(strong.tagName.toLowerCase()).toBe("strong");
    expect(screen.queryByText(/\*\*important\*\*/)).not.toBeInTheDocument();
  });

  it("renders a bullet list as real <ul><li> elements", () => {
    render(<BountyDescription description={"- first step\n- second step"} />);

    expect(screen.getByText("first step").closest("li")).toBeInTheDocument();
    expect(screen.getByText("second step").closest("li")).toBeInTheDocument();
  });

  it("renders an ordered list as real <ol><li> elements with decimal styling", () => {
    render(<BountyDescription description={"1. first\n2. second\n3. third"} />);

    const ol = screen.getByText("first").closest("ol");
    expect(ol).toBeInTheDocument();
    expect(ol?.className).toContain("list-decimal");
    expect(screen.getByText("first").closest("li")).toBeInTheDocument();
    expect(screen.getByText("second").closest("li")).toBeInTheDocument();
    expect(screen.getByText("third").closest("li")).toBeInTheDocument();
  });

  it("renders a blockquote with a logical border on the inline-start edge", () => {
    // `border-s-*` / `ps-*` rather than `border-l-*` / `pl-*` (#456). The
    // border sits on the blockquote's inline-start edge, which is the correct
    // semantic — a physical left border lands on the wrong side of the bar
    // once the document direction is right-to-left. This renderer handles
    // untrusted third-party issue Markdown, so it is the highest-RTL-risk
    // component in the app.
    render(<BountyDescription description={"> quoted text"} />);

    const blockquote = screen.getByText("quoted text").closest("blockquote");
    expect(blockquote).toBeInTheDocument();
    expect(blockquote?.className).toContain("border-s-2");
    expect(blockquote?.className).toContain("ps-4");
    expect(blockquote?.className).not.toMatch(/border-l-|pl-4/);
    expect(blockquote?.className).toContain("italic");
  });

  it("remaps h1→h2, h2→h3, h3→h4 so issue headings don't compete with the page title", () => {
    render(
      <BountyDescription
        description={"# Top Level\n\n## Section\n\n### Subsection"}
      />,
    );

    const h1 = screen.getByText("Top Level");
    expect(h1.tagName.toLowerCase()).toBe("h2");

    const h2 = screen.getByText("Section");
    expect(h2.tagName.toLowerCase()).toBe("h3");

    const h3 = screen.getByText("Subsection");
    expect(h3.tagName.toLowerCase()).toBe("h4");
  });

  it("styles h4/h5/h6 headings instead of falling back to unstyled defaults (#214)", () => {
    render(
      <BountyDescription
        description={
          "#### Steps to reproduce\n\n##### Expected\n\n###### Actual"
        }
      />,
    );

    const h4 = screen.getByText("Steps to reproduce");
    expect(h4.tagName.toLowerCase()).toBe("h5");
    expect(h4.className).toContain("font-semibold");

    const h5 = screen.getByText("Expected");
    expect(h5.tagName.toLowerCase()).toBe("h6");
    expect(h5.className).toContain("font-semibold");

    const h6 = screen.getByText("Actual");
    expect(h6.tagName.toLowerCase()).toBe("p");
    expect(h6.className).toContain("font-semibold");
  });

  it("renders a markdown image with layout-safe classes instead of an unstyled bare <img> (#215)", () => {
    const { container } = render(
      <BountyDescription description="![a screenshot](https://user-images.githubusercontent.com/1/shot.png)" />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute(
      "src",
      "https://user-images.githubusercontent.com/1/shot.png",
    );
    expect(img).toHaveAttribute("alt", "a screenshot");
    expect(img?.className).toContain("max-w-full");
    expect(img?.className).toContain("aspect-video");
    expect(img?.className).toContain("object-contain");
  });

  it("renders a GFM table as real <table>/<thead>/<tbody>/<tr>/<th>/<td> elements with styling", () => {
    const description =
      "| Token | Amount |\n|-------|--------|\n| USDC  | 100    |\n| XLM   | 500    |";
    const { container } = render(
      <BountyDescription description={description} />,
    );

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table?.className).toContain("w-full");

    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();

    const tbody = container.querySelector("tbody");
    expect(tbody).toBeInTheDocument();

    const ths = container.querySelectorAll("th");
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe("Token");
    expect(ths[1].textContent).toBe("Amount");

    const tds = container.querySelectorAll("td");
    expect(tds.length).toBe(4);
    expect(tds[0].textContent).toBe("USDC");
    expect(tds[1].textContent).toBe("100");
  });
});

describe("BountyDescription — untrusted-content hardening", () => {
  it("renders an embedded <img onerror> payload inertly, with no onerror attribute ever mounted", () => {
    (window as unknown as { __xss?: number }).__xss = undefined;
    const payload = 'Ignore this: <img src=x onerror="window.__xss=1">';

    const { container } = render(<BountyDescription description={payload} />);

    // No <img> element with an onerror handler was ever created — the raw
    // HTML tag must render as inert literal text, not a real DOM element.
    const img = container.querySelector("img[onerror]");
    expect(img).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("neutralizes a javascript: URL in a markdown link rather than passing it through to href", () => {
    render(<BountyDescription description="[click me](javascript:alert(1))" />);

    const link = screen.queryByRole("link", { name: "click me" });
    if (link) {
      const href = link.getAttribute("href") ?? "";
      expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
    }
    // Whether rendered as a neutralized link or plain text, the dangerous
    // scheme must never reach a real, clickable href in the DOM.
    expect(document.querySelector('a[href^="javascript:" i]')).toBeNull();
  });

  it("renders a raw <script> tag embedded in the markdown as inert text, never as an executable script element", () => {
    const payload = "Notes: <script>window.__xss = 1;</script> end";
    (window as unknown as { __xss?: number }).__xss = undefined;

    const { container } = render(<BountyDescription description={payload} />);

    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });
});
