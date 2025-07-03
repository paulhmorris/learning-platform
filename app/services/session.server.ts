import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
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
    const { sessionClaims } = await getAuth(args);
    return sessionClaims?.eid ?? null;
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
    throw Responses.redirectToSignIn(args.request.url);
  }

  async requireUserId(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const userId = await this.getUserId(args);

    // There might be a case where a db user didn't get linked to their clerk external_id
    if (!userId) {
      console.error("external_id not found in claims. Attempting to link...", { requestUrl: args.request.url });

      const { userId: clerkId, sessionId } = await this.getSession(args);
      if (!clerkId) {
        console.error("No userId found in session, redirecting to sign in", { requestUrl: args.request.url });
        await this.logout(sessionId);
        throw Responses.redirectToSignIn(args.request.url);
      }

      const user = await db.user.findUniqueOrThrow({ where: { clerkId } });
      console.info("Found user with clerkId", { clerkId, userId: user.id });

      const clerkUser = await AuthService.saveExternalId(clerkId, user.id);
      console.info("Successfully linked user to Clerk", { clerkId, userId: clerkUser.externalId });

      // We still need to log them out to refresh the session
      await this.logout(sessionId);
      throw Responses.redirectToSignIn(args.request.url);
    }

    return userId;
  }

  private async requireUserByRole(args: LoaderFunctionArgs | ActionFunctionArgs, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const user = await this.getUser(args);

    if (!user) {
      throw Responses.unauthorized();
    }

    if (user.role === UserRole.SUPERADMIN) {
      return user;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        return user;
      }
      throw Responses.unauthorized();
    }

    if (defaultAllowedRoles.includes(user.role)) {
      return user;
    }

    throw Responses.forbidden();
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
