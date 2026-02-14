import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseHeader } from "./course-header";

describe("CourseHeader", () => {
  it("renders the course title", () => {
    render(<CourseHeader courseTitle="Test Course" />);
    expect(screen.getByText("Test Course")).toBeInTheDocument();
  });

  it("renders lesson count when numLessons is provided", () => {
    render(<CourseHeader courseTitle="Test" numLessons={10} />);
    expect(screen.getByText("10 Lessons")).toBeInTheDocument();
  });

  it("renders singular Lesson for 1 lesson", () => {
    render(<CourseHeader courseTitle="Test" numLessons={1} />);
    expect(screen.getByText("1 Lesson")).toBeInTheDocument();
  });

  it("does not render lesson count when numLessons is 0", () => {
    render(<CourseHeader courseTitle="Test" numLessons={0} />);
    expect(screen.queryByText(/Lesson/)).not.toBeInTheDocument();
  });

  it("does not render lesson count when numLessons is omitted", () => {
    render(<CourseHeader courseTitle="Test" />);
    expect(screen.queryByText(/Lesson/)).not.toBeInTheDocument();
  });

  it("always renders static content", () => {
    render(<CourseHeader courseTitle="Test" />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Accessible on tablet and phone")).toBeInTheDocument();
    expect(screen.getByText("Certification upon completion")).toBeInTheDocument();
  });
});
