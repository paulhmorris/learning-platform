import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { LessonInOrder } from "~/lib/utils";
import { CourseUpNext } from "./course-up-next";

function renderWithRouter(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => ui,
      HydrateFallback: () => null,
    },
    { path: "/:lessonSlug", Component: () => <div>Lesson</div> },
    { path: "/quizzes/:quizId", Component: () => <div>Quiz</div> },
  ]);
  return render(<Stub />);
}

describe("CourseUpNext", () => {
  const makeLesson = (overrides: Partial<LessonInOrder> = {}): LessonInOrder => ({
    id: 1,
    uuid: undefined,
    slug: "intro-to-driving",
    title: "Intro to Driving",
    sectionId: 1,
    sectionTitle: "Section 1",
    isCompleted: false,
    isTimed: true,
    hasVideo: true,
    requiredDurationInSeconds: 120,
    progressDuration: 0,
    ...overrides,
  });
  it("renders nothing when neither lesson nor quiz is provided", () => {
    const { container } = renderWithRouter(<CourseUpNext />);
    expect(container.innerHTML).toBe("");
  });

  it("renders quiz section when quiz is provided", () => {
    renderWithRouter(<CourseUpNext quiz={{ id: 1, numQuestions: 5 }} />);
    expect(screen.getByText("Up next:")).toBeInTheDocument();
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("5 questions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/quizzes/1");
  });

  it("renders singular 'question' for 1 question quiz", () => {
    renderWithRouter(<CourseUpNext quiz={{ id: 2, numQuestions: 1 }} />);
    expect(screen.getByText("1 question")).toBeInTheDocument();
  });

  it("renders lesson section with Start link when no progress", () => {
    const lesson = makeLesson();
    renderWithRouter(<CourseUpNext lesson={lesson} />);
    expect(screen.getByText("Intro to Driving")).toBeInTheDocument();
    expect(screen.getByText("2 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/intro-to-driving");
  });

  it("renders Continue link when lesson has progress", () => {
    const lesson = makeLesson({ hasVideo: false, progressDuration: 60 });
    renderWithRouter(<CourseUpNext lesson={lesson} />);
    expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument();
  });

  it("does not render duration when requiredDurationInSeconds is 0", () => {
    const lesson = makeLesson({
      title: "Short Lesson",
      slug: "short-lesson",
      hasVideo: false,
      requiredDurationInSeconds: 0,
      isTimed: false,
    });
    renderWithRouter(<CourseUpNext lesson={lesson} />);
    expect(screen.getByText("Short Lesson")).toBeInTheDocument();
    expect(screen.queryByText("min")).not.toBeInTheDocument();
  });
});
