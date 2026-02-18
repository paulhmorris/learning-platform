import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { MarkCompleteButton } from "./mark-complete-button";

function renderWithRouter(props: { lessonId: number; isCompleted: boolean }) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <MarkCompleteButton {...props} />,
      HydrateFallback: () => null,
    },
    {
      path: "/api/progress",
      action: () => ({ ok: true }),
    },
  ]);
  return render(<Stub />);
}

describe("MarkCompleteButton", () => {
  it("renders an enabled button when lesson is not completed", () => {
    renderWithRouter({ lessonId: 1, isCompleted: false });
    const button = screen.getByRole("button", { name: /mark complete/i });
    expect(button).toBeEnabled();
  });

  it("disables button when lesson is completed", () => {
    renderWithRouter({ lessonId: 1, isCompleted: true });
    const button = screen.getByRole("button", { name: /mark complete/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Lesson is already completed");
  });

  it("includes the lessonId as a hidden input", () => {
    renderWithRouter({ lessonId: 42, isCompleted: false });
    const hiddenInput = document.querySelector('input[name="lessonId"]')!;
    expect(hiddenInput).toHaveValue("42");
  });

  it("submits with intent mark-complete", () => {
    renderWithRouter({ lessonId: 1, isCompleted: false });
    const button = screen.getByRole("button", { name: /mark complete/i });
    expect(button).toHaveAttribute("value", "mark-complete");
  });
});
