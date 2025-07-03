import { Prisma, UserRole } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
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
    console.info("User created or updated:", user);

    const stripeCustomer = await PaymentService.createCustomer(user.id, { metadata: { clerk_id: clerkId } });
    console.info("Stripe customer created:", stripeCustomer.id);

    await this.update(user.id, { stripeId: stripeCustomer.id });
    console.info("User updated with Stripe ID:", user.id);
    return user;
  },

  async update(id: string, data: Prisma.UserUpdateArgs["data"]) {
    const user = await db.user.update({ where: { id }, data, select: { id: true } });
    return user;
  },

  async delete(id: string) {
    await db.user.delete({ where: { id } });
  },
};
