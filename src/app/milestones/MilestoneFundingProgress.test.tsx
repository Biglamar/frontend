import { render, screen } from "@testing-library/react";
import { MilestoneFundingProgress } from "./MilestoneFundingProgress";

describe("MilestoneFundingProgress", () => {
  it("shows unfunded milestones at zero without non-finite values", () => {
    render(
      <MilestoneFundingProgress budget={0} distributed={50} asset="USDC" />,
    );

    expect(screen.getByText("Not yet funded")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({
      width: "0%",
    });
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("labels over-funded milestones and clamps the progress bar to 100%", () => {
    render(
      <MilestoneFundingProgress budget={100} distributed={125} asset="USDC" />,
    );

    expect(screen.getByText("Over-funded")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({
      width: "100%",
    });
  });

  it("shows the correct percentage and width for an in-progress milestone", () => {
    render(
      <MilestoneFundingProgress budget={200} distributed={50} asset="USDC" />,
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({
      width: "25%",
    });
  });
});
