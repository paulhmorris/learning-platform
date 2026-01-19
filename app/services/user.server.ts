import { isClerkAPIResponseError } from "@clerk/shared/error";
import { UserRole } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";
import { UserCourseService } from "~/services/user-course.server";

const logger = createLogger("UserService");

export const UserService = {
  async getById(id: string) {
    try {
      const [backendUser, userCourses] = await Promise.all([
        clerkClient.users.getUser(id),
        UserCourseService.getAllByUserId(id),
      ]);
      return {
        courses: userCourses,
        firstName: backendUser.firstName!,
        lastName: backendUser.lastName!,
        email: backendUser.primaryEmailAddress!.emailAddress,
        phone: backendUser.primaryPhoneNumber?.phoneNumber,
        isActive: !backendUser.locked,
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

  async create(clerkId: string) {
    try {
      const stripeCustomer = await PaymentService.createCustomer(clerkId);
      const user = await AuthService.updatePublicMetadata(clerkId, {
        role: UserRole.USER,
        stripeCustomerId: stripeCustomer.id,
      });
      logger.info(`Metadata saved for user ${user.id}`);
      return user;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to create user with Clerk ID ${clerkId}`, { error });
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
