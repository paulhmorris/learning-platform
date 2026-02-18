import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  isRouteErrorResponse: vi.fn(),
  useRouteError: vi.fn(),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { isRouteErrorResponse, useRouteError } from "react-router";

import { Sentry } from "~/integrations/sentry";

import { ErrorComponent } from "./error-component";

const mockUseRouteError = vi.mocked(useRouteError);
const mockIsRouteErrorResponse = vi.mocked(isRouteErrorResponse);

describe("ErrorComponent", () => {
  it("shows 404 message for a 404 route error", () => {
    const routeError = { status: 404, statusText: "Not Found", data: null, internal: false };
    mockUseRouteError.mockReturnValue(routeError);
    mockIsRouteErrorResponse.mockReturnValue(true);

    render(<ErrorComponent />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("The requested page could not be found.")).toBeInTheDocument();
  });

  it("shows generic error message for non-404 route error", () => {
    const routeError = { status: 500, statusText: "Internal Server Error", data: null, internal: false };
    mockUseRouteError.mockReturnValue(routeError);
    mockIsRouteErrorResponse.mockReturnValue(true);

    render(<ErrorComponent />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
  });

  it("falls back to default details when statusText is empty", () => {
    const routeError = { status: 500, statusText: "", data: null, internal: false };
    mockUseRouteError.mockReturnValue(routeError);
    mockIsRouteErrorResponse.mockReturnValue(true);

    render(<ErrorComponent />);
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("captures Error instances with Sentry and shows details in dev", () => {
    const error = new Error("Test error message");
    error.stack = "Error: Test error message\n    at test.ts:1:1";
    mockUseRouteError.mockReturnValue(error);
    mockIsRouteErrorResponse.mockReturnValue(false);

    render(<ErrorComponent />);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    // In dev mode (default for vitest), details and stack are shown
    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getByText("Stack Trace")).toBeInTheDocument();
  });

  it("uses the error prop as a fallback when useRouteError returns undefined", () => {
    const error = new Error("Prop error");
    mockUseRouteError.mockReturnValue(undefined);
    mockIsRouteErrorResponse.mockReturnValue(false);

    render(<ErrorComponent error={error} />);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
  });

  it("shows default fallback when error is unknown", () => {
    mockUseRouteError.mockReturnValue("string error");
    mockIsRouteErrorResponse.mockReturnValue(false);

    render(<ErrorComponent />);
    expect(screen.getByText("Oops!")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
    expect(screen.queryByText("Stack Trace")).not.toBeInTheDocument();
  });
});
