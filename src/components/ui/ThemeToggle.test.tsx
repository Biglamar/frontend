import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

function renderWithTheme(theme: "light" | "dark", toggle = jest.fn()) {
  mockUseTheme.mockReturnValue({ theme, toggle } as unknown as ReturnType<
    typeof useTheme
  >);
  const utils = render(<ThemeToggle />);
  return { ...utils, toggle };
}

describe("ThemeToggle", () => {
  afterEach(() => jest.clearAllMocks());

  // Guards the icon-selection branch fixed in #208: dark mode shows the sun
  // (switch to light), light mode shows the moon (switch to dark).
  it("renders the Sun icon, not the Moon, in dark mode", () => {
    const { container } = renderWithTheme("dark");
    expect(container.querySelector("svg.lucide-sun")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-moon")).not.toBeInTheDocument();
  });

  it("renders the Moon icon, not the Sun, in light mode", () => {
    const { container } = renderWithTheme("light");
    expect(container.querySelector("svg.lucide-moon")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-sun")).not.toBeInTheDocument();
  });

  it("labels the button with the action it will perform", () => {
    renderWithTheme("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("labels the button for switching to dark mode in light mode", () => {
    renderWithTheme("light");
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)(
    "calls toggle() once when clicked in %s mode",
    async (theme) => {
      const user = userEvent.setup();
      const { toggle } = renderWithTheme(theme);
      await user.click(screen.getByRole("button"));
      expect(toggle).toHaveBeenCalledTimes(1);
    },
  );
});
