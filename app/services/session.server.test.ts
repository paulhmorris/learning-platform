import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuth = vi.fn();

vi.mock("@clerk/react-router/ssr.server", () => ({
  getAuth: (...args: Array<unknown>) => mockGetAuth(...args),
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/lib/responses.server", () => ({
  Responses: {
    redirectToSignIn: vi.fn((url: string) => {
      throw new Response(null, { status: 302, headers: { Location: `/sign-in?redirect_url=${url}` } });
    }),
    forbidden: vi.fn(() => {
      throw new Response(null, { status: 403 });
    }),
  },
}));

import { SessionService } from "./session.server";

function makeFakeArgs(url = "https://example.com/course") {
  return {
    request: new Request(url),
    params: {},
    context: {},
  } as never;
}

function makeAuth(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: true,
    userId: "user_1",
    sessionClaims: {
      pem: "user@example.com",
      fn: "John",
      ln: "Doe",
      phn: "+1234567890",
      role: "USER",
      idV: false,
      strpId: "cus_123",
      strpIdV: "vs_123",
      ...overrides,
    },
    ...overrides,
  };
}

describe("SessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("returns enriched auth object when authenticated", async () => {
      mockGetAuth.mockResolvedValue(makeAuth());

      const result = await SessionService.requireAuth(makeFakeArgs());
      expect(result.id).toBe("user_1");
      expect(result.email).toBe("user@example.com");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.role).toBe("USER");
    });

    it("throws redirect when not authenticated", async () => {
      mockGetAuth.mockResolvedValue({ isAuthenticated: false });

      await expect(SessionService.requireAuth(makeFakeArgs())).rejects.toThrow();
    });
  });

  describe("requireUser", () => {
    it("returns auth for USER role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ role: "USER" }));

      const result = await SessionService.requireUser(makeFakeArgs());
      expect(result.id).toBe("user_1");
    });

    it("returns auth for ADMIN role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ sessionClaims: { ...makeAuth().sessionClaims, role: "ADMIN" } }));

      const result = await SessionService.requireUser(makeFakeArgs());
      expect(result.id).toBe("user_1");
    });

    it("throws forbidden for unauthorized role", async () => {
      mockGetAuth.mockResolvedValue(
        makeAuth({
          sessionClaims: { ...makeAuth().sessionClaims, role: "UNKNOWN" },
        }),
      );

      await expect(SessionService.requireUser(makeFakeArgs())).rejects.toThrow();
    });
  });

  describe("requireAdmin", () => {
    it("returns auth for ADMIN role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ sessionClaims: { ...makeAuth().sessionClaims, role: "ADMIN" } }));

      const result = await SessionService.requireAdmin(makeFakeArgs());
      expect(result.id).toBe("user_1");
    });

    it("returns auth for SUPERADMIN role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ sessionClaims: { ...makeAuth().sessionClaims, role: "SUPERADMIN" } }));

      const result = await SessionService.requireAdmin(makeFakeArgs());
      expect(result.id).toBe("user_1");
    });

    it("throws forbidden for USER role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth());

      await expect(SessionService.requireAdmin(makeFakeArgs())).rejects.toThrow();
    });
  });

  describe("requireSuperAdmin", () => {
    it("returns auth for SUPERADMIN role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ sessionClaims: { ...makeAuth().sessionClaims, role: "SUPERADMIN" } }));

      const result = await SessionService.requireSuperAdmin(makeFakeArgs());
      expect(result.id).toBe("user_1");
    });

    it("throws forbidden for ADMIN role", async () => {
      mockGetAuth.mockResolvedValue(makeAuth({ sessionClaims: { ...makeAuth().sessionClaims, role: "ADMIN" } }));

      await expect(SessionService.requireSuperAdmin(makeFakeArgs())).rejects.toThrow();
    });
  });
});
