import { Prisma, UserRole } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";
import { UserCourseService } from "~/services/user-course.server";

const logger = createLogger("UserService");

type ClerkData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};
type UserWithPIIAndCourses = Prisma.UserGetPayload<any> &
  ClerkData & {
    isActive: boolean;
  } & {
    courses?: Awaited<ReturnType<typeof UserCourseService.getAllByUserId>>;
  };

export const UserService = {
  async getById(id: string) {
    try {
      const user = await db.user.findUnique({
        where: { id },
        // include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } },
      });

      if (!user) {
        return null;
      }

      // TODO: Clerk migration
      const userCourses = await UserCourseService.getAllByUserId(user.clerkId!);
      // TODO: Remove when clerkId is required
      const backendUser = await clerkClient.users.getUser(user.clerkId!);
      const userWithPII: UserWithPIIAndCourses = {
        ...user,
        courses: userCourses,
        firstName: backendUser.firstName!,
        lastName: backendUser.lastName!,
        email: backendUser.primaryEmailAddress!.emailAddress,
        phone: backendUser.primaryPhoneNumber?.phoneNumber,
        isActive: !backendUser.locked,
      };
      return userWithPII;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get user by ID ${id}`, { error });
      throw error;
    }
  },

  async getByClerkId(clerkId: string) {
    try {
      const user = await db.user.findUnique({
        where: { clerkId },
        // include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } },
      });

      if (!user) {
        return null;
      }

      // TODO: Clerk migration
      const userCourses = await UserCourseService.getAllByUserId(user.clerkId!);
      // TODO: Remove when clerkId is required
      const backendUser = await clerkClient.users.getUser(user.clerkId!);
      const userWithPII: UserWithPIIAndCourses = {
        ...user,
        courses: userCourses,
        firstName: backendUser.firstName!,
        lastName: backendUser.lastName!,
        email: backendUser.primaryEmailAddress!.emailAddress,
        phone: backendUser.primaryPhoneNumber?.phoneNumber,
        isActive: !backendUser.locked,
      };
      return userWithPII;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get user by Clerk ID ${clerkId}`, { error });
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

  async update(id: string, data: Prisma.UserUpdateArgs["data"]) {
    try {
      return db.user.update({ where: { id }, data, select: { id: true } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to update user ${id}`, { error });
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
        db.user.delete({ where: { id: userId } }),
      ]);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete user ${userId}`, { error });
      throw error;
    }
  },

  async deleteByClerkId(clerkId: string) {
    try {
      const user = await this.getByClerkId(clerkId);
      if (!user) {
        throw new Error(`User with Clerk ID ${clerkId} not found`);
      }
      return this.delete(user.id);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete user by Clerk ID ${clerkId}`, { error });
      throw error;
    }
  },
};
