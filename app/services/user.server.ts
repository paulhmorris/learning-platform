import { Prisma, User } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";

class Service {
  async resetOrSetupPassword({ userId, password }: { userId: User["id"]; password: string }) {
    const hashedPassword = await AuthService.hashPassword(password);

    const user = await db.user.update({
      where: { id: userId },
      data: {
        password: {
          upsert: {
            create: { hash: hashedPassword },
            update: { hash: hashedPassword },
          },
        },
      },
    });
    return user;
  }
  public async getById(id: User["id"]) {
    const cachedUser = await redis.get<
      Prisma.UserGetPayload<{
        include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } };
      }>
    >(`user-${id}`);
    if (cachedUser) {
      return cachedUser;
    }
    const user = await db.user.findUnique({
      where: { id },
      include: { courses: { include: { course: { select: { requiresIdentityVerification: true } } } } },
    });
    if (user) {
      await redis.set<User>(`user-${id}`, user, { ex: 30 });
    }
    return user;
  }

  public async getByEmail(email: User["email"]) {
    const user = await db.user.findUnique({
      where: { email },
      include: {
        password: true,
      },
    });
    if (user) {
      await redis.set<User>(`user-${user.id}`, user, { ex: 30 });
    }
    return user;
  }

  public async getByEmailWithPassword(email: User["email"]) {
    const user = await db.user.findUnique({
      where: { email },
      include: { password: true },
    });
    return user;
  }

  public async create(email: User["email"], password: string, data: Omit<Prisma.UserCreateArgs["data"], "email">) {
    const hashedPassword = await AuthService.hashPassword(password);
    const user = await db.user.create({
      data: {
        ...data,
        email,
        password: {
          create: {
            hash: hashedPassword,
          },
        },
      },
    });

    const stripeCus = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName}${user.lastName ? " " + user.lastName : ""}`,
      phone: user.phone ?? undefined,
      metadata: {
        user_id: user.id,
      },
    });

    await db.user.update({
      where: { id: user.id },
      data: { stripeId: stripeCus.id },
    });
    await redis.set<User>(`user-${user.id}`, user, { ex: 30 });
    return user;
  }

  public async exists(email: User["email"]) {
    const count = await db.user.count({ where: { email } });
    return count > 0;
  }

  public async update(id: User["id"], data: Prisma.UserUpdateArgs["data"]) {
    const user = await db.user.update({ where: { id }, data });
    await redis.del(`user-${user.id}`);
    return user;
  }

  public async delete(id: User["id"]) {
    const user = await db.user.delete({ where: { id } });
    await redis.del(`user-${user.id}`);
    return user;
  }

  public async deleteByEmail(email: User["email"]) {
    const user = await db.user.delete({ where: { email } });
    await redis.del(`user-${user.id}`);
    return user;
  }
}

export const UserService = new Service();
