import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuizQuestion } from "./quiz-question";

describe("QuizQuestion", () => {
  it("renders nothing when answers are undefined", () => {
    const { container } = render(<QuizQuestion question="What?" questionIndex={0} answers={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when answers array is empty", () => {
    const { container } = render(<QuizQuestion question="What?" questionIndex={0} answers={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the question text and all answers", () => {
    const answers = [
      { answer: "Option A", is_correct: false },
      { answer: "Option B", is_correct: true },
    ];
    render(<QuizQuestion question="What is the answer?" questionIndex={0} answers={answers} />);
    expect(screen.getByText("What is the answer?")).toBeInTheDocument();
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("skips rendering answers with empty text", () => {
    const answers = [
      { answer: "Valid", is_correct: false },
      { answer: "", is_correct: false },
    ];
    render(<QuizQuestion question="Q?" questionIndex={0} answers={answers} />);
    expect(screen.getByText("Valid")).toBeInTheDocument();
    // The empty answer should not render a label
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(1);
  });

  it("renders radio inputs for each answer with correct name attribute", () => {
    const answers = [
      { answer: "A", is_correct: false },
      { answer: "B", is_correct: true },
    ];
    render(<QuizQuestion question="Q" questionIndex={3} answers={answers} />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute("name", "question-3");
    });
  });
});
