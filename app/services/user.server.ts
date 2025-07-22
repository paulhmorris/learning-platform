import { Prisma, UserRole } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";

const logger = createLogger("UserService");

type ClerkData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};
type UserWithPIIAndCourses = Prisma.UserGetPayload<{
  include: {
    courses: {
      include: {
        course: { select: { requiresIdentityVerification: true } };
      };
    };
  };
}> &
  ClerkData & {
    isActive: boolean;
  };

export const UserService = {
  async getById(id: string) {
    try {
      const user = await db.user.findUnique({
        where: { id },
        include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } },
      });

      if (!user) {
        return null;
      }

      // TODO: Remove when clerkId is required
      const backendUser = await clerkClient.users.getUser(user.clerkId!);
      const userWithPII: UserWithPIIAndCourses = {
        ...user,
        firstName: backendUser.firstName!,
        lastName: backendUser.lastName!,
        email: backendUser.primaryEmailAddress!.emailAddress,
        phone: backendUser.primaryPhoneNumber?.phoneNumber,
        isActive: !backendUser.locked,
      };
      return userWithPII;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get user by ID", { error, userId: id });
      throw error;
    }
  },

  async getByClerkId(clerkId: string) {
    try {
      const user = await db.user.findUnique({
        where: { clerkId },
        include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } },
      });

      if (!user) {
        return null;
      }

      // TODO: Remove when clerkId is required
      const backendUser = await clerkClient.users.getUser(user.clerkId!);
      const userWithPII: UserWithPIIAndCourses = {
        ...user,
        firstName: backendUser.firstName!,
        lastName: backendUser.lastName!,
        email: backendUser.primaryEmailAddress!.emailAddress,
        phone: backendUser.primaryPhoneNumber?.phoneNumber,
        isActive: !backendUser.locked,
      };
      return userWithPII;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get user by Clerk ID", { error, clerkId });
      throw error;
    }
  },

  async create(clerkId: string) {
    try {
      const user = await db.user.upsert({
        where: { clerkId },
        update: {},
        create: { clerkId, role: UserRole.USER },
      });
      logger.info("User upserted:", { user });

      const stripeCustomer = await PaymentService.createCustomer(user.id, { metadata: { clerk_id: clerkId } });
      logger.info("Stripe customer created:", { stripeCustomer });

      await this.update(user.id, { stripeId: stripeCustomer.id });
      logger.info("User updated with Stripe ID:", { userId: user.id, stripeId: stripeCustomer.id });

      await AuthService.saveExternalId(clerkId, user.id);
      logger.info("External ID saved for user:", { userId: user.id });
      return user;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to create user", { error, clerkId });
      throw error;
    }
  },

  async update(id: string, data: Prisma.UserUpdateArgs["data"]) {
    try {
      return db.user.update({ where: { id }, data, select: { id: true } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to update user", { error, userId: id });
      throw error;
    }
  },

  async delete(userId: string) {
    try {
      return db.$transaction([
        db.userQuizProgress.deleteMany({ where: { userId } }),
        db.userLessonProgress.deleteMany({ where: { userId } }),
        db.userCourses.deleteMany({ where: { userId } }),
        db.user.delete({ where: { id: userId } }),
      ]);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to delete user", { error, userId });
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
      logger.error("Failed to delete user by Clerk ID", { error, clerkId });
      throw error;
    }
  },
};
