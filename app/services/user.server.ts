import { Prisma, User, UserRole } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { PaymentService } from "~/services/payment.server";

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
    const cachedUser = await redis.get<UserWithPIIAndCourses>(`user-${id}`);
    if (cachedUser) {
      return cachedUser;
    }

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
    await redis.set(`user-${id}`, userWithPII, { ex: 30 });
    return userWithPII;
  },

  async getByClerkId(clerkId: string) {
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
  },

  async create(clerkId: string) {
    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, role: UserRole.USER },
    });

    const { id } = await PaymentService.createCustomer(user.id, { metadata: { clerk_id: clerkId } });

    await db.user.update({ where: { id: user.id }, data: { stripeId: id }, select: {} });
    await redis.set(`user-${user.id}`, user, { ex: 30 });
    return user;
  },

  async update(id: User["id"], data: Prisma.UserUpdateArgs["data"]) {
    const user = await db.user.update({ where: { id }, data, select: { id: true } });
    await redis.del(`user-${user.id}`);
    return user;
  },
};
