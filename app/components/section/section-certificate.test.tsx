import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useProgress", () => ({
  useProgress: vi.fn().mockReturnValue({ isLoading: false, lessonProgress: [], quizProgress: [] }),
}));

import { SectionCertificate } from "./section-certificate";

function renderWithRouter(isCourseCompleted: boolean, pathname = "/preview") {
  const Stub = createRoutesStub([
    {
      path: pathname,
      Component: () => <SectionCertificate isCourseCompleted={isCourseCompleted} />,
      HydrateFallback: () => null,
    },
    { path: "/certificate", Component: () => <div>Certificate Page</div> },
  ]);
  return render(<Stub initialEntries={[pathname]} />);
}

describe("SectionCertificate", () => {
  it("renders an enabled Claim link when course is completed", () => {
    renderWithRouter(true);
    const link = screen.getByRole("link", { name: "Claim" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/certificate");
  });

  it("renders a disabled Claim button when course is not completed", () => {
    renderWithRouter(false);
    const button = screen.getByRole("button", { name: "Claim" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("renders Certificate section header and item", () => {
    renderWithRouter(false);
    expect(screen.getAllByText("Certificate")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Certificate" })).toBeInTheDocument();
  });
});
