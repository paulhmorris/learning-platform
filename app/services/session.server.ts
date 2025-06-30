import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";

import { forbidden, unauthorized } from "~/lib/responses.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

class Session {
  private static USER_SESSION_KEY = "userId";

  async logout(sessionId: string | null) {
    if (sessionId) {
      await AuthService.revokeSession(sessionId);
    }
  }

  async getSession(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return getAuth(args);
  }

  async getUserId(args: LoaderFunctionArgs | ActionFunctionArgs): Promise<string | null> {
    const { userId } = await getAuth(args);
    return userId;
  }

  async getUser(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const userId = await this.getUserId(args);
    if (!userId) {
      return null;
    }

    const user = await UserService.getById(userId);
    if (user) {
      return user;
    }

    throw await this.logout(args);
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
}

export const SessionService = new Session();
