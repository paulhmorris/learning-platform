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
    logger.info("Logging out user", { sessionId });
    return AuthService.revokeSession(sessionId);
  }

  async getUser(args: Args) {
    const { userId, sessionId } = await this.getSession(args);
    if (!userId) {
      logger.warn("No userId found in session claims", { sessionId });
      return null;
    }

    const user = await this.getOrCreateUserByClerkId(userId);

    logger.debug("Returning user found in the database", { userId, sessionId });
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
      logger.error("external_id not found in claims. Attempting to link...", {
        external_id: externalId,
        requestUrl: args.request.url,
      });

      if (!clerkId) {
        logger.error("No userId found in session, redirecting to sign in", { redirectUrl: args.request.url });
        throw Responses.redirectToSignIn(args.request.url);
      }

      const user = await this.getOrCreateUserByClerkId(clerkId);
      if (!user) {
        logger.error("Failed to find or create user", { clerkId });
        throw Responses.redirectToSignIn(args.request.url);
      }

      logger.info("Found user with clerkId", { clerkId, userId: user.id });

      const clerkUser = await AuthService.saveExternalId(clerkId, user.id);
      logger.info("Successfully linked user to Clerk", { clerkId, userId: clerkUser.externalId });

      if (!clerkUser.externalId) {
        logger.error("Linked user to Clerk, but externalId is still missing", { clerkId, userId: user.id });
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
    logger.debug("Getting session from Clerk", { requestUrl: args.request.url });
    return getAuth(args);
  }

  private async getOrCreateUserByClerkId(clerkId: string) {
    const user = await UserService.getByClerkId(clerkId);
    if (user) {
      return user;
    }

    logger.warn("User not found in the database, attempting to create...", { clerkId });
    const newUser = await UserService.create(clerkId);
    return UserService.getByClerkId(newUser.clerkId!);
  }

  private async requireUserByRole(args: Args, allowedRoles?: Array<UserRole>) {
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
}

export const SessionService = new _SessionService();
