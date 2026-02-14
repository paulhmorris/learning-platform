import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/usePersistentCountdown", () => ({
  usePersistentCountdown: vi.fn().mockReturnValue({ countdownValue: 120, reachedRequiredTime: false }),
}));

import { usePersistentCountdown } from "~/hooks/usePersistentCountdown";

import { QuizQuestions } from "./quiz-questions";

const mockUsePersistentCountdown = vi.mocked(usePersistentCountdown);

type QuizProps = Parameters<typeof QuizQuestions>[0];

function makeQuiz(overrides: Partial<QuizProps["quiz"]["attributes"]> = {}): QuizProps["quiz"] {
  return {
    id: 1,
    attributes: {
      uuid: "test-quiz-uuid",
      required_duration_in_seconds: 0,
      questions: [
        {
          question: "What is 1 + 1?",
          answers: [
            { answer: "2", is_correct: true },
            { answer: "3", is_correct: false },
          ],
        },
      ],
      ...overrides,
    },
  } as QuizProps["quiz"];
}

function renderWithRouter(props: QuizProps, actionData: Record<string, unknown> | null = null) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <QuizQuestions {...props} />,
      HydrateFallback: () => null,
      action: () => actionData,
    },
  ]);
  return render(<Stub />);
}

describe("QuizQuestions", () => {
  it("renders questions and an enabled submit button for untimed quiz", () => {
    renderWithRouter({ quiz: makeQuiz(), progress: null });
    expect(screen.getByText("What is 1 + 1?")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).toBeEnabled();
  });

  it("disables the submit button for a timed quiz before required time is reached", () => {
    mockUsePersistentCountdown.mockReturnValue({ countdownValue: 60, reachedRequiredTime: false });
    renderWithRouter({ quiz: makeQuiz({ required_duration_in_seconds: 120 }), progress: null });
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it("enables the submit button for a timed quiz after required time is reached", () => {
    mockUsePersistentCountdown.mockReturnValue({ countdownValue: 0, reachedRequiredTime: true });
    renderWithRouter({ quiz: makeQuiz({ required_duration_in_seconds: 120 }), progress: null });
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).toBeEnabled();
  });

  it("hides submit button when quiz is already passed", () => {
    renderWithRouter({
      quiz: makeQuiz(),
      progress: { quizId: 1, isCompleted: true, score: 100 } as QuizProps["progress"],
    });
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("disables the fieldset when quiz is already completed", () => {
    renderWithRouter({
      quiz: makeQuiz(),
      progress: { quizId: 1, isCompleted: true, score: 100 } as QuizProps["progress"],
    });
    const fieldset = screen.getByRole("group");
    expect(fieldset).toBeDisabled();
  });
});
