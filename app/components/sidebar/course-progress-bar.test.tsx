import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useProgress", () => ({
  useProgress: vi.fn().mockReturnValue({ isLoading: false, lessonProgress: [], quizProgress: [] }),
}));

import { CourseProgressBar } from "./course-progress-bar";

describe("CourseProgressBar", () => {
  it("renders nothing when percentage is NaN", () => {
    const { container } = render(<CourseProgressBar progress={0} duration={0} isTimed={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders timed display with normalized seconds", () => {
    render(<CourseProgressBar progress={120} duration={600} isTimed={true} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/course completed/)).toBeInTheDocument();
  });

  it("renders untimed display with bold percentage", () => {
    render(<CourseProgressBar progress={50} duration={100} isTimed={false} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/of course completed/)).toBeInTheDocument();
  });

  it("rounds percentage up with Math.ceil", () => {
    render(<CourseProgressBar progress={1} duration={3} isTimed={false} />);
    // 1/3 * 100 = 33.33 -> ceil = 34
    expect(screen.getByText("34%")).toBeInTheDocument();
  });
});
