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
      logger.debug({ sessionId }, "Logging out user");
      await AuthService.revokeSession(sessionId);
    }
    logger.debug("No sessionId provided, skipping logout");
    throw Responses.redirectToSignIn("/");
  }

  async getSession(args: LoaderFunctionArgs | ActionFunctionArgs) {
    logger.debug({ requestUrl: args.request.url }, "Getting session from Clerk");
    return getAuth(args);
  }

  async getUserId(args: LoaderFunctionArgs | ActionFunctionArgs): Promise<string | null> {
    const { sessionClaims } = await getAuth(args);
    logger.debug({ requestUrl: args.request.url, userId: sessionClaims?.eid }, "Getting userId from session claims");
    return sessionClaims?.eid ?? null;
  }

  async getUser(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const { userId, sessionId } = await this.getSession(args);
    if (!userId) {
      logger.warn({ sessionId }, "No userId found in session claims");
      return null;
    }

    const user = await UserService.getByClerkId(userId);
    if (user) {
      logger.debug({ userId, sessionId }, "Returning user found in the database");
      return user;
    }

    logger.warn({ clerkId: userId, sessionId }, `User not found in the database, logging out`);
    await this.logout(sessionId);
    throw Responses.redirectToSignIn(args.request.url);
  }

  async requireUserId(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const userId = await this.getUserId(args);

    // There might be a case where a db user didn't get linked to their clerk external_id
    if (!userId) {
      logger.error({ requestUrl: args.request.url }, "external_id not found in claims. Attempting to link...");

      const { userId: clerkId, sessionId } = await this.getSession(args);
      if (!clerkId) {
        logger.error({ requestUrl: args.request.url }, "No userId found in session, redirecting to sign in");
        await this.logout(sessionId);
        throw Responses.redirectToSignIn(args.request.url);
      }

      const user = await db.user.findUniqueOrThrow({ where: { clerkId } });
      logger.info({ clerkId, userId: user.id }, "Found user with clerkId");

      const clerkUser = await AuthService.saveExternalId(clerkId, user.id);
      logger.info({ clerkId, userId: clerkUser.externalId }, "Successfully linked user to Clerk");

      // We still need to log them out to refresh the session
      await this.logout(sessionId);
      throw Responses.redirectToSignIn(args.request.url);
    }

    return userId;
  }

  private async requireUserByRole(args: LoaderFunctionArgs | ActionFunctionArgs, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const user = await this.getUser(args);
    logger.debug({ requestUrl: args.request.url, userId: user?.id, allowedRoles }, "Checking user role");

    if (!user) {
      logger.warn({ requestUrl: args.request.url }, "No user found");
      throw Responses.unauthorized();
    }

    if (user.role === UserRole.SUPERADMIN) {
      logger.debug({ userId: user.id }, "User is a super admin, allowing access");
      return user;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        logger.debug({ userId: user.id, role: user.role }, "User has required role, allowing access");
        return user;
      }
      logger.warn({ userId: user.id, role: user.role }, "User does not have required role");
      throw Responses.unauthorized();
    }

    if (defaultAllowedRoles.includes(user.role)) {
      logger.debug({ userId: user.id, role: user.role }, "User has default allowed role, allowing access");
      return user;
    }

    logger.warn({ userId: user.id, role: user.role }, "User does not have any allowed roles");
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
