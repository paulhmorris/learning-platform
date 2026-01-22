import { isClerkAPIResponseError } from "@clerk/shared/error";

import { UserRole } from "~/config";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";
import { UserCourseService } from "~/services/user-course.server";

const logger = createLogger("UserService");

export const UserService = {
  /**
   * Gets the full user object from Clerk.
   * Should be used sparingly due to rate limits.
   * For most cases use SessionService.getUser().
   */
  async getById(id: string) {
    try {
      const [user, userCourses] = await Promise.all([
        clerkClient.users.getUser(id),
        UserCourseService.getAllByUserId(id),
      ]);
      return {
        id: user.id,
        courses: userCourses,
        firstName: user.firstName!,
        lastName: user.lastName!,
        email: user.primaryEmailAddress!.emailAddress,
        phone: user.primaryPhoneNumber?.phoneNumber,
        isActive: !user.locked,
        publicMetadata: user.publicMetadata,
      };
    } catch (error) {
      if (isClerkAPIResponseError(error) && error.status === 404) {
        logger.warn(`User with ID ${id} not found in Clerk`);
        return null;
      }
      Sentry.captureException(error);
      logger.error(`Failed to get user by ID ${id}`, { error });
      throw error;
    }
  },

  async linkToStripe(userId: string) {
    try {
      // Check if user already has a Stripe customer (idempotency check)
      const existingUser = await this.getById(userId);
      if (existingUser?.publicMetadata.stripeCustomerId) {
        logger.info(`User ${userId} already linked to Stripe customer ${existingUser.publicMetadata.stripeCustomerId}`);
        return await clerkClient.users.getUser(userId);
      }

      const stripeCustomer = await PaymentService.createCustomer(userId);
      const user = await AuthService.updatePublicMetadata(userId, {
        role: UserRole.USER,
        stripeCustomerId: stripeCustomer.id,
        stripeVerificationSessionId: null,
        isIdentityVerified: false,
      });
      logger.info(`Metadata saved for user ${user.id}`);
      return user;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to create user with Clerk ID ${userId}`, { error });
      throw error;
    }
  },

  // TODO: Clerk migration
  async delete(userId: string) {
    try {
      return db.$transaction([
        db.userQuizProgress.deleteMany({ where: { userId } }),
        db.userLessonProgress.deleteMany({ where: { userId } }),
        db.userCourse.deleteMany({ where: { userId } }),
      ]);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete data for user ${userId}`, { error });
      throw error;
    }
  },
};
