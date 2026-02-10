import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { AccountCourses } from "./courses";

function makeCourse(overrides: Partial<{ isCompleted: boolean; title: string }> = {}) {
  return {
    id: 1,
    title: overrides.title ?? "Hip Hop Driving",
    description: "Learn to drive with hip hop music.",
    isCompleted: overrides.isCompleted ?? false,
    createdAt: new Date("2024-01-01"),
    course: { host: "hiphopdriving.com" },
  };
}

function makeUserCourse(overrides: Partial<{ completedAt: Date | null; certificateClaimed: boolean }> = {}) {
  return {
    course: { strapiId: 1 },
    completedAt: overrides.completedAt ?? null,
    certificateClaimed: overrides.certificateClaimed ?? false,
    certificate: overrides.certificateClaimed ? { s3Key: "certs/cert.pdf" } : null,
  };
}

function renderWithRouter(props: Parameters<typeof AccountCourses>[0]) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <AccountCourses {...props} />,
      HydrateFallback: () => null,
    },
  ]);
  return render(<Stub />);
}

describe("AccountCourses", () => {
  it("shows a message when no courses are enrolled", () => {
    renderWithRouter({ courses: [] as any, userCourses: [] as any });
    expect(screen.getByText("You are not currently enrolled in any courses")).toBeInTheDocument();
  });

  it("shows enrolled message when courses exist", () => {
    renderWithRouter({ courses: [makeCourse()] as any, userCourses: [] as any });
    expect(screen.getByText("You are enrolled in the following courses")).toBeInTheDocument();
  });

  it("renders Complete badge when course is completed", () => {
    renderWithRouter({ courses: [makeCourse({ isCompleted: true })] as any, userCourses: [] as any });
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("renders Incomplete badge when course is not completed", () => {
    renderWithRouter({ courses: [makeCourse({ isCompleted: false })] as any, userCourses: [] as any });
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("renders View Certificate link when certificate is claimed", () => {
    const courses = [makeCourse({ isCompleted: true })];
    const userCourses = [makeUserCourse({ certificateClaimed: true, completedAt: new Date("2024-06-01") })];
    renderWithRouter({ courses: courses as any, userCourses: userCourses as any });
    expect(screen.getByText("View Certificate")).toBeInTheDocument();
  });

  it("does not render View Certificate link when no certificate", () => {
    renderWithRouter({
      courses: [makeCourse()] as any,
      userCourses: [makeUserCourse()] as any,
    });
    expect(screen.queryByText("View Certificate")).not.toBeInTheDocument();
  });
});
