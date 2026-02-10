import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_PAGE_KEY } from "~/lib/constants";

import { useAnalytics } from "./useAnalytics";

vi.mock("@clerk/react-router", () => ({
  useUser: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLocation: vi.fn(),
}));

vi.mock("~/integrations/mixpanel.client", () => ({
  Analytics: {
    init: vi.fn(),
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
    identifyUser: vi.fn(),
    clearUser: vi.fn(),
  },
}));

import { useUser } from "@clerk/react-router";
import type { UserResource } from "@clerk/types";
import type { Location } from "react-router";
import { useLocation } from "react-router";

import { Analytics } from "~/integrations/mixpanel.client";

const mockUseUser = vi.mocked(useUser);
const mockUseLocation = vi.mocked(useLocation);
const analyticsMock = Analytics as unknown as {
  init: ReturnType<typeof vi.fn>;
  trackPageView: ReturnType<typeof vi.fn>;
  trackEvent: ReturnType<typeof vi.fn>;
  identifyUser: ReturnType<typeof vi.fn>;
  clearUser: ReturnType<typeof vi.fn>;
};

function TestComponent() {
  useAnalytics();
  return null;
}

type UseUserReturn = ReturnType<typeof useUser>;
type SignedOutReturn = Extract<UseUserReturn, { isSignedIn: false }>;
type SignedInReturn = Extract<UseUserReturn, { isSignedIn: true }>;

const makeSignedOutReturn = (): SignedOutReturn => ({
  isLoaded: true,
  isSignedIn: false,
  user: null,
});

const makeSignedInReturn = (user: UserResource): SignedInReturn => ({
  isLoaded: true,
  isSignedIn: true,
  user,
});

describe("useAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).ENV = { VERCEL_ENV: "production" };
    sessionStorage.clear();
    const location: Location = {
      pathname: "/preview",
      search: "?a=1",
      hash: "#top",
      state: null,
      key: "default",
    };
    mockUseLocation.mockReturnValue(location);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("initializes and tracks a page view in production", async () => {
    mockUseUser.mockReturnValue(makeSignedOutReturn());

    render(<TestComponent />);

    await waitFor(() => {
      expect(analyticsMock.init).toHaveBeenCalledTimes(1);
      expect(analyticsMock.trackPageView).toHaveBeenCalledWith("/preview?a=1#top");
    });
  });

  it("skips analytics when not in production", async () => {
    (window as any).ENV = { VERCEL_ENV: "preview" };
    mockUseUser.mockReturnValue(makeSignedOutReturn());

    render(<TestComponent />);

    await waitFor(() => {
      expect(analyticsMock.init).not.toHaveBeenCalled();
      expect(analyticsMock.trackPageView).not.toHaveBeenCalled();
    });
  });

  it("identifies the user when signed in", async () => {
    const user = {
      id: "user_123",
      primaryEmailAddress: { emailAddress: "user@example.com" },
      firstName: "Test",
      lastName: "User",
    } as UserResource;
    mockUseUser.mockReturnValue(makeSignedInReturn(user));

    render(<TestComponent />);

    await waitFor(() => {
      expect(analyticsMock.init).toHaveBeenCalled();
      expect(analyticsMock.identifyUser).toHaveBeenCalledWith({
        id: "user_123",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
      });
    });
  });

  it("tracks sign-in completion when auth page is sign-in", async () => {
    sessionStorage.setItem(AUTH_PAGE_KEY, "/sign-in");
    const user = {
      id: "user_456",
      primaryEmailAddress: null,
      firstName: null,
      lastName: null,
    } as UserResource;
    mockUseUser.mockReturnValue(makeSignedInReturn(user));

    render(<TestComponent />);

    await waitFor(() => {
      expect(analyticsMock.trackEvent).toHaveBeenCalledWith("sign_in_completed");
      expect(sessionStorage.getItem(AUTH_PAGE_KEY)).toBeNull();
    });
  });

  it("clears the user when signed out", async () => {
    mockUseUser.mockReturnValue(makeSignedOutReturn());

    render(<TestComponent />);

    await waitFor(() => {
      expect(analyticsMock.clearUser).toHaveBeenCalledTimes(1);
    });
  });
});
