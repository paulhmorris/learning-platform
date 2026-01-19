import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";
import { AuthService } from "~/services/auth.server";

const logger = createLogger("SessionService");

type Args = LoaderFunctionArgs | ActionFunctionArgs;

class _SessionService {
  async logout(sessionId: string) {
    logger.info(`Logging out user with session ${sessionId}`);
    return AuthService.revokeSession(sessionId);
  }

  async requireAuth(args: Args) {
    const auth = await getAuth(args);

    if (!auth.isAuthenticated) {
      throw Responses.redirectToSignIn(args.request.url);
    }

    return auth;
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

  private async requireUserByRole(args: Args, allowedRoles?: Array<UserRole>) {
    const defaultAllowedRoles: Array<UserRole> = ["USER", "ADMIN"];
    const auth = await getAuth(args);
    logger.debug(`Checking user role for ${args.request.url} (user ${auth.userId})`);

    if (!auth.isAuthenticated) {
      logger.warn(`No user found for ${args.request.url}`);
      throw Responses.unauthorized();
    }

    const role = auth.sessionClaims.role ?? UserRole.USER;
    if (role === UserRole.SUPERADMIN) {
      logger.debug(`User ${auth.userId} is a super admin, allowing access`);
      return auth;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(role)) {
        logger.debug(`User ${auth.userId} has required role ${role}, allowing access`);
        return auth;
      }
      logger.warn(`User ${auth.userId} does not have required role (has ${role})`);
      throw Responses.unauthorized();
    }

    if (defaultAllowedRoles.includes(role)) {
      logger.debug(`User ${auth.userId} has default allowed role ${role}, allowing access`);
      return auth;
    }

    logger.warn(`User ${auth.userId} does not have any allowed roles (has ${role})`);
    throw Responses.forbidden();
  }
}

export const SessionService = new _SessionService();
