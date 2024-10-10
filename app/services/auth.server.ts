import bcrypt from "bcryptjs";

import { db } from "~/integrations/db.server";

class Service {
  public hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  public compare(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  public async generateReset(email: string) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const reset = await db.passwordReset.create({
      data: {
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        user: { connect: { id: user.id } },
      },
      select: { id: true, token: true },
    });
    return reset;
  }

  public async getResetByToken(token: string) {
    const reset = await db.passwordReset.findUnique({
      where: { token },
      select: {
        token: true,
        userId: true,
        expiresAt: true,
      },
    });
    return reset;
  }

  public async getResetByUserId(userId: string) {
    const reset = await db.passwordReset.findFirst({
      where: { userId, expiresAt: { gte: new Date() } },
    });
    return reset;
  }

  public async expireReset(token: string) {
    const reset = await db.passwordReset.updateMany({
      where: { token },
      data: { expiresAt: new Date(0), usedAt: new Date() },
    });
    return reset;
  }

  public async deleteReset(id: string) {
    const reset = await db.passwordReset.delete({ where: { id }, select: {} });
    return reset;
  }
}

export const AuthService = new Service();
