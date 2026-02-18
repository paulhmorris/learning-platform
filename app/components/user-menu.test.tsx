import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/react-router", () => ({
  useUser: vi.fn(),
  SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
  SignOutButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/hooks/useRootData", () => ({
  useRootData: vi.fn(),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { setUser: vi.fn() },
}));

import { useUser } from "@clerk/react-router";
import type { UserResource } from "@clerk/types";

import { useRootData } from "~/hooks/useRootData";

import { UserMenu } from "./user-menu";

const mockUseUser = vi.mocked(useUser);
const mockUseRootData = vi.mocked(useRootData);

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

function renderWithRouter(pathname = "/preview") {
  const Stub = createRoutesStub([
    {
      path: pathname,
      Component: () => <UserMenu />,
      HydrateFallback: () => null,
    },
  ]);
  return render(<Stub initialEntries={[pathname]} />);
}

describe("UserMenu", () => {
  it("renders nothing when user is null", () => {
    mockUseUser.mockReturnValue(makeSignedOutReturn());
    mockUseRootData.mockReturnValue(undefined);
    const { container } = renderWithRouter();
    expect(container.innerHTML).toBe("");
  });

  it("renders the menu trigger when user is signed in", () => {
    const user = {
      id: "user_1",
      firstName: "John",
      lastName: "Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
      publicMetadata: { role: "USER" },
    } as unknown as UserResource;

    mockUseUser.mockReturnValue(makeSignedInReturn(user));
    mockUseRootData.mockReturnValue(undefined);

    renderWithRouter();
    expect(screen.getByRole("button", { name: /open user menu/i })).toBeInTheDocument();
  });
});
