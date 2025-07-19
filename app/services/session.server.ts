import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("SessionService");

class _SessionService {
  async logout(sessionId: string | null) {
    if (sessionId) {
      logger.info("Logging out user", { sessionId });
      await AuthService.revokeSession(sessionId);
    }
    logger.info("No sessionId provided, skipping logout and redirecting to sign in");
    throw Responses.redirectToSignIn("/");
  }

  async getSession(args: LoaderFunctionArgs | ActionFunctionArgs) {
    logger.debug("Getting session from Clerk", { requestUrl: args.request.url });
    return getAuth(args);
  }

  async getUserId(args: LoaderFunctionArgs | ActionFunctionArgs): Promise<string | null> {
    const { sessionClaims } = await getAuth(args);
    logger.debug("Getting userId from session claims", { requestUrl: args.request.url, userId: sessionClaims?.eid });
    return sessionClaims?.eid ?? null;
  }

  async getUser(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const { userId, sessionId } = await this.getSession(args);
    if (!userId) {
      logger.warn("No userId found in session claims", { sessionId });
      return null;
    }

    const user = await UserService.getByClerkId(userId);
    if (user) {
      logger.debug("Returning user found in the database", { userId, sessionId });
      return user;
    }

    logger.warn("User not found in the database, logging out", { clerkId: userId, sessionId });
    await this.logout(sessionId);
    throw Responses.redirectToSignIn(args.request.url);
  }

  async requireUserId(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const userId = await this.getUserId(args);

    // There might be a case where a db user didn't get linked to their clerk external_id
    if (!userId) {
      logger.error("external_id not found in claims. Attempting to link...", { requestUrl: args.request.url });

      const { userId: clerkId, sessionId } = await this.getSession(args);
      if (!clerkId) {
        logger.error("No userId found in session, redirecting to sign in", { requestUrl: args.request.url });
        await this.logout(sessionId);
        throw Responses.redirectToSignIn(args.request.url);
      }

      const user = await db.user.findUniqueOrThrow({ where: { clerkId } });
      logger.info("Found user with clerkId", { clerkId, userId: user.id });

      const clerkUser = await AuthService.saveExternalId(clerkId, user.id);
      logger.info("Successfully linked user to Clerk", { clerkId, userId: clerkUser.externalId });

      // We still need to log them out to refresh the session
      await this.logout(sessionId);
      throw Responses.redirectToSignIn(args.request.url);
    }

    return userId;
  }

  private async requireUserByRole(args: LoaderFunctionArgs | ActionFunctionArgs, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const user = await this.getUser(args);
    logger.debug("Checking user role", { requestUrl: args.request.url, userId: user?.id, allowedRoles });

    if (!user) {
      logger.warn("No user found", { requestUrl: args.request.url });
      throw Responses.unauthorized();
    }

    if (user.role === UserRole.SUPERADMIN) {
      logger.debug("User is a super admin, allowing access", { userId: user.id });
      return user;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        logger.debug("User has required role, allowing access", { userId: user.id, role: user.role });
        return user;
      }
      logger.warn("User does not have required role", { userId: user.id, role: user.role });
      throw Responses.unauthorized();
    }

    if (defaultAllowedRoles.includes(user.role)) {
      logger.debug("User has default allowed role, allowing access", { userId: user.id, role: user.role });
      return user;
    }

    logger.warn("User does not have any allowed roles", { userId: user.id, role: user.role });
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
