import { Prisma, User } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
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
    const cachedUser = await redis.get<Prisma.UserGetPayload<{ include: { courses: true } }>>(`user-${id}`);
    if (cachedUser) {
      return cachedUser;
    }
    const user = await db.user.findUnique({ where: { id }, include: { courses: true } });
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
    return user;
  }

  public async update(id: User["id"], data: Prisma.UserUpdateArgs["data"]) {
    const user = await db.user.update({ where: { id }, data });
    return user;
  }
  public async delete(id: User["id"]) {
    const user = await db.user.delete({ where: { id } });
    return user;
  }

  public async deleteByEmail(email: User["email"]) {
    const user = await db.user.delete({ where: { email } });
    return user;
  }
}

export const UserService = new Service();
