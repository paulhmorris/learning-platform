import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("renders a progressbar with the correct value", () => {
    render(<ProgressBar id="test" value={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value at 0 for negative input", () => {
    render(<ProgressBar id="test" value={-10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps value at 100 for input exceeding 100", () => {
    render(<ProgressBar id="test" value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("rounds up fractional values with Math.ceil", () => {
    render(<ProgressBar id="test" value={33.2} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "34");
  });

  it("sets the inner bar width based on normalized value", () => {
    const { container } = render(<ProgressBar id="test" value={75} />);
    const inner = container.querySelector("[role='presentation']");
    expect(inner).toHaveStyle({ width: "75%" });
  });
});
