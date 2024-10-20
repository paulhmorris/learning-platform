import bcrypt from "bcryptjs";

import { db } from "~/integrations/db.server";
import { UserService } from "~/services/user.server";

class Service {
  public hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  public compare(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  public async verifyLogin(email: string, password: string) {
    const userWithPassword = await UserService.getByEmailWithPassword(email);
    if (!userWithPassword || !userWithPassword.password) {
      return null;
    }

    const isValid = await bcrypt.compare(password, userWithPassword.password.hash);

    if (!isValid) {
      return null;
    }

    const { password: _password, ...userWithoutPassword } = userWithPassword;

    return userWithoutPassword;
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

  public async generateVerification(userId: string) {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const verification = await db.userVerification.upsert({
      where: { userId },
      create: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        token,
        user: {
          connect: { id: userId },
        },
      },
      update: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        token,
      },
      select: {
        token: true,
      },
    });
    return verification;
  }

  public async getVerificationByUserId(userId: string) {
    const verification = await db.userVerification.findUnique({
      where: { userId, expiresAt: { gte: new Date() } },
    });
    return verification;
  }
}

export const AuthService = new Service();
