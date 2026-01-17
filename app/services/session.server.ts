import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("SessionService");

type Args = LoaderFunctionArgs | ActionFunctionArgs;

class _SessionService {
  async logout(sessionId: string) {
    logger.info(`Logging out user with session ${sessionId}`);
    return AuthService.revokeSession(sessionId);
  }

  async getUser(args: Args) {
    const { userId, sessionId } = await this.getSession(args);
    if (!userId) {
      logger.warn(`No userId found in session claims for session ${sessionId}`);
      return null;
    }

    const user = await this.getOrCreateUserByClerkId(userId);

    logger.debug(`Returning user ${userId} found in the database (session ${sessionId})`);
    return user;
  }

  async requireUserId(args: Args): Promise<string> {
    const { sessionClaims, userId: clerkId } = await this.getSession(args);

    if (!clerkId) {
      throw Responses.redirectToSignIn(args.request.url);
    }

    const externalId = sessionClaims.eid ?? null;

    // There might be a case where a db user didn't get linked to their clerk external_id
    if (!externalId) {
      logger.error(`external_id not found in claims for ${args.request.url}. Attempting to link...`);

      if (!clerkId) {
        logger.error(`No userId found in session, redirecting to sign in: ${args.request.url}`);
        throw Responses.redirectToSignIn(args.request.url);
      }

      const user = await this.getOrCreateUserByClerkId(clerkId);
      if (!user) {
        logger.error(`Failed to find or create user with Clerk ID ${clerkId}`);
        throw Responses.redirectToSignIn(args.request.url);
      }

      logger.info(`Found user ${user.id} with Clerk ID ${clerkId}`);

      const clerkUser = await AuthService.saveExternalId(clerkId, user.id);
      logger.info(`Successfully linked user ${clerkUser.externalId} to Clerk ID ${clerkId}`);

      if (!clerkUser.externalId) {
        logger.error(`Linked user ${user.id} to Clerk, but externalId is still missing (Clerk ID ${clerkId})`);
        throw Responses.redirectToSignIn(args.request.url);
      }
      return clerkUser.externalId;
    }

    return externalId;
  }

  async requireUser(args: Args) {
    return this.requireUserByRole(args);
  }

  async requireAdmin(args: Args) {
    return this.requireUserByRole(args, ["ADMIN"]);
  }

  async requireSuperAdmin(args: Args) {
    return this.requireUserByRole(args, ["SUPERADMIN"]);
  }

  private async getSession(args: Args) {
    logger.debug(`Getting session from Clerk for ${args.request.url}`);
    return getAuth(args);
  }

  private async getOrCreateUserByClerkId(clerkId: string) {
    const user = await UserService.getByClerkId(clerkId);
    if (user) {
      return user;
    }

    logger.warn(`User not found in database with Clerk ID ${clerkId}, attempting to create...`);
    const newUser = await UserService.create(clerkId);
    return UserService.getByClerkId(newUser.clerkId!);
  }

  private async requireUserByRole(args: Args, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const user = await this.getUser(args);
    logger.debug(`Checking user role for ${args.request.url} (user ${user?.id ?? "unknown"})`);

    if (!user) {
      logger.warn(`No user found for ${args.request.url}`);
      throw Responses.unauthorized();
    }

    if (user.role === UserRole.SUPERADMIN) {
      logger.debug(`User ${user.id} is a super admin, allowing access`);
      return user;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(user.role)) {
        logger.debug(`User ${user.id} has required role ${user.role}, allowing access`);
        return user;
      }
      logger.warn(`User ${user.id} does not have required role (has ${user.role})`);
      throw Responses.unauthorized();
    }

    if (defaultAllowedRoles.includes(user.role)) {
      logger.debug(`User ${user.id} has default allowed role ${user.role}, allowing access`);
      return user;
    }

    logger.warn(`User ${user.id} does not have any allowed roles (has ${user.role})`);
    throw Responses.forbidden();
  }
}

export const SessionService = new _SessionService();
