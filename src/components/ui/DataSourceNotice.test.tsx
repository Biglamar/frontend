import { render, screen } from "@testing-library/react";
import { DataSourceNotice } from "./DataSourceNotice";

describe("DataSourceNotice", () => {
  it("renders nothing when source is live", () => {
    const { container } = render(<DataSourceNotice source="live" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders badge variant with default label for mock source", () => {
    render(<DataSourceNotice source="mock" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Sample data");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("bg-amber-50");
  });

  it("renders inline variant with plain text styling", () => {
    render(<DataSourceNotice source="mock" variant="inline" />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Sample data");
    expect(notice.className).toContain("text-xs");
    expect(notice.className).not.toContain("rounded-full");
  });

  it("accepts custom label text", () => {
    render(<DataSourceNotice source="mock" label="Mock Data" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Mock Data");
  });

  it("applies custom className", () => {
    render(<DataSourceNotice source="mock" className="custom-class" />);
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("custom-class");
  });

  it("does not render for live source regardless of variant", () => {
    const { container: c1 } = render(<DataSourceNotice source="live" variant="badge" />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<DataSourceNotice source="live" variant="inline" />);
    expect(c2.firstChild).toBeNull();
  });

  it("has role=status for accessibility", () => {
    render(<DataSourceNotice source="mock" />);
    const notice = screen.getByRole("status");
    expect(notice).toBeInTheDocument();
  });
});
