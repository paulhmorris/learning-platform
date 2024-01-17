import { User, UserRole } from "@prisma/client";
import { Session as RemixSession, SessionData, redirect } from "@remix-run/node";

import { forbidden, unauthorized } from "~/lib/responses.server";
import { sessionStorage } from "~/lib/session.server";
import { UserService } from "~/services/UserService.server";

interface ISessionService {
  getSession(request: Request): Promise<RemixSession<SessionData, SessionData>>;
  commitSession(session: RemixSession<SessionData, SessionData>): Promise<string>;
  getUserId(request: Request): Promise<User["id"] | undefined>;
  getUser(request: Request): Promise<User | null>;
  getSessionUser(request: Request): Promise<User | null>;
  requireUserId(request: Request, redirectTo?: string): Promise<User["id"]>;
  requireAdmin(request: Request): Promise<User>;
  requireSuperAdmin(request: Request): Promise<User>;
  createUserSession({
    request,
    userId,
    remember,
    redirectTo,
  }: {
    request: Request;
    userId: string;
    remember: boolean;
    redirectTo: string;
  }): Promise<Response>;
}

class Session implements ISessionService {
  private static USER_SESSION_KEY = "userId";

  async logout(request: Request) {
    const session = await this.getSession(request);
    return redirect("/login", {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
      },
    });
  }

  async getSession(request: Request) {
    const cookie = request.headers.get("Cookie");
    return sessionStorage.getSession(cookie);
  }

  async commitSession(session: RemixSession<SessionData, SessionData>) {
    return sessionStorage.commitSession(session);
  }

  async getUserId(request: Request): Promise<User["id"] | undefined> {
    const session = await this.getSession(request);
    const userId = session.get(Session.USER_SESSION_KEY) as User["id"] | undefined;
    return userId;
  }

  async getUser(request: Request) {
    const userId = await this.getUserId(request);
    if (userId === undefined) return null;

    const user = await UserService.getById(userId);
    if (user) return user;

    throw await this.logout(request);
  }

  async getSessionUser(request: Request) {
    const userId = await this.getUserId(request);
    if (userId === undefined) return null;

    const user = await UserService.getById(userId);
    if (user) return user;

    throw await this.logout(request);
  }

  async requireUserId(request: Request, redirectTo: string = new URL(request.url).pathname) {
    const userId = await this.getUserId(request);
    if (!userId) {
      const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
      throw redirect(`/login?${searchParams.toString()}`);
    }
    return userId;
  }

  private async requireUserByRole(request: Request, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const userId = await this.requireUserId(request);

    const user = await UserService.getById(userId);

    if (user && user.role === UserRole.SUPERADMIN) {
      return user;
    }

    if (user && allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        return user;
      }
      throw unauthorized({ user });
    }

    if (user && defaultAllowedRoles.includes(user.role)) {
      return user;
    }
    throw forbidden({ user });
  }

  async requireUser(request: Request) {
    return this.requireUserByRole(request);
  }

  async requireAdmin(request: Request) {
    return this.requireUserByRole(request, ["ADMIN"]);
  }

  async requireSuperAdmin(request: Request) {
    return this.requireUserByRole(request, ["SUPERADMIN"]);
  }

  async createUserSession({
    request,
    userId,
    remember,
    redirectTo,
  }: {
    request: Request;
    userId: string;
    remember: boolean;
    redirectTo: string;
  }) {
    const session = await this.getSession(request);
    session.set(Session.USER_SESSION_KEY, userId);
    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session, {
          maxAge: remember
            ? 60 * 60 * 24 * 7 // 7 days
            : undefined,
        }),
      },
    });
  }
}

export const SessionService = new Session();
