import { getAuth } from "@clerk/react-router/ssr.server";
import { UserRole } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";

const logger = createLogger("SessionService");

type Args = LoaderFunctionArgs | ActionFunctionArgs;

class _SessionService {
  async requireAuth(args: Args) {
    const auth = await getAuth(args);

    if (!auth.isAuthenticated) {
      throw Responses.redirectToSignIn(args.request.url);
    }

    return {
      ...auth,
      id: auth.userId,
      email: auth.sessionClaims.pem,
      firstName: auth.sessionClaims.fn,
      lastName: auth.sessionClaims.ln,
      phoneNumber: auth.sessionClaims.phn,
      role: auth.sessionClaims.role ?? UserRole.USER,
      isIdentityVerified: auth.sessionClaims.idV ?? false,
      stripeCustomerId: auth.sessionClaims.strpId,
      stripeVerificationSessionId: auth.sessionClaims.strpIdV,
    };
  }

  requireUser(args: Args) {
    return this.requireUserRole(args, ["USER", "ADMIN", "SUPERADMIN"]);
  }

  requireAdmin(args: Args) {
    return this.requireUserRole(args, ["ADMIN", "SUPERADMIN"]);
  }

  requireSuperAdmin(args: Args) {
    return this.requireUserRole(args, ["SUPERADMIN"]);
  }

  private async requireUserRole(args: Args, allowedRoles: Array<UserRole>) {
    const auth = await this.requireAuth(args);
    const role = auth.sessionClaims.role ?? UserRole.USER;
    if (!allowedRoles.includes(role)) {
      logger.warn(`User with role ${role} is not authorized to access this resource`);
      throw Responses.forbidden();
    }
    return auth;
  }
}

export const SessionService = new _SessionService();
