import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useProgress", () => ({
  useProgress: vi.fn().mockReturnValue({ isLoading: false, lessonProgress: [], quizProgress: [] }),
}));

import { APIResponseData } from "~/types/utils";
import { PreviewSectionQuiz } from "./preview-section-quiz";

function makeQuiz(questionCount: number) {
  return {
    id: 1,
    attributes: {
      title: "Quiz 1",
      questions: { count: questionCount },
      passing_score: 80,
    },
  } as unknown as APIResponseData<"api::quiz.quiz">;
}

describe("PreviewSectionQuiz", () => {
  it("renders locked state with disabled styling and aria-label", () => {
    render(<PreviewSectionQuiz quiz={makeQuiz(5)} userProgress={null} locked />);
    const container = screen.getByLabelText("This quiz is locked until all section lessons are completed.");
    expect(container).toBeInTheDocument();
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("5 questions")).toBeInTheDocument();
  });

  it("renders singular 'question' for single question quiz", () => {
    render(<PreviewSectionQuiz quiz={makeQuiz(1)} userProgress={null} locked />);
    expect(screen.getByText("1 question")).toBeInTheDocument();
  });

  it("renders unlocked state when not locked and no progress", () => {
    render(<PreviewSectionQuiz quiz={makeQuiz(3)} userProgress={null} />);
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("3 questions")).toBeInTheDocument();
    expect(screen.queryByLabelText(/locked/)).not.toBeInTheDocument();
  });

  it("renders completed state when quiz is completed", () => {
    render(<PreviewSectionQuiz quiz={makeQuiz(3)} userProgress={{ quizId: 1, isCompleted: true }} />);
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });
});
