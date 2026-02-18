import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { QuizResults } from "./quiz-results";

function renderWithRouter(
  props: { isPassed: boolean; score: number },
  actionData: Record<string, unknown> | null = null,
) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <QuizResults {...props} />,
      HydrateFallback: () => null,
      action: () => actionData,
    },
  ]);
  return render(<Stub />);
}

describe("QuizResults", () => {
  it("shows passed message when isPassed is true", () => {
    renderWithRouter({ isPassed: true, score: 85 });
    expect(screen.getByText("You passed!")).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it("renders nothing when not passed and no action data", () => {
    renderWithRouter({ isPassed: false, score: 50 });
    expect(screen.queryByText("You passed!")).not.toBeInTheDocument();
    expect(screen.queryByText("You didn't pass.")).not.toBeInTheDocument();
  });

  it("has alert role for accessibility", () => {
    renderWithRouter({ isPassed: true, score: 100 });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
