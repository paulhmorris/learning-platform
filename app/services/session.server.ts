import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { forbidden, redirectToSignIn, unauthorized } from "~/lib/responses.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

class _SessionService {
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
    const { userId, sessionId } = await this.getSession(args);
    if (!userId) {
      return null;
    }

    const user = await UserService.getByClerkId(userId);
    if (user) {
      return user;
    }

    console.warn(`User not not found in the database, logging out`, { clerkId: userId, sessionId });
    await this.logout(sessionId);
    throw redirectToSignIn(args.request.url);
  }

  async requireUserId(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const userId = await this.getUserId(args);
    if (!userId) {
      console.error("User ID is required but not found in the session.", { requestUrl: args.request.url });
      throw redirectToSignIn(args.request.url);
    }
    return userId;
  }

  private async requireUserByRole(args: LoaderFunctionArgs | ActionFunctionArgs, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const user = await this.getUser(args);

    if (!user) {
      throw unauthorized("Unauthorized");
    }

    if (user.role === UserRole.SUPERADMIN) {
      return user;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        return user;
      }
      throw unauthorized("Unauthorized");
    }

    if (defaultAllowedRoles.includes(user.role)) {
      return user;
    }

    throw forbidden("Forbidden");
  }

  async requireUser(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return this.requireUserByRole(args);
  }

  async requireAdmin(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return this.requireUserByRole(args, ["ADMIN"]);
  }

  async requireSuperAdmin(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return this.requireUserByRole(args, ["SUPERADMIN"]);
  }
}

export const SessionService = new _SessionService();
