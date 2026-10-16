/**
 * ErrorBoundary.test.tsx (#621)
 *
 * Covers the shared fallback UI used by multiple route error.tsx files:
 * renders the error message, title, and a reset button that calls reset().
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("renders the default title when none is provided", () => {
    render(
      <ErrorBoundary error={new Error("Something broke")} reset={() => {}} />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a custom title", () => {
    render(
      <ErrorBoundary
        error={new Error("Something broke")}
        reset={() => {}}
        title="Failed to load issues"
      />,
    );
    expect(screen.getByText("Failed to load issues")).toBeInTheDocument();
  });

  it("renders the error message", () => {
    render(
      <ErrorBoundary error={new Error("Network timeout")} reset={() => {}} />,
    );
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("renders a fallback message when error has no message", () => {
    render(<ErrorBoundary error={new Error()} reset={() => {}} />);
    expect(
      screen.getByText("An unexpected error occurred. Please try again."),
    ).toBeInTheDocument();
  });

  it("calls reset when the Try again button is clicked", async () => {
    const reset = jest.fn();
    render(<ErrorBoundary error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error on mount", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("logged error");
    render(<ErrorBoundary error={error} reset={() => {}} />);
    expect(spy).toHaveBeenCalledWith("[ErrorBoundary]", error);
    spy.mockRestore();
  });
});
