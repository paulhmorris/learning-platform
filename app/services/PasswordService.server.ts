import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { db } from "~/integrations/db.server";
import { withServiceErrorHandling } from "~/services/helpers";
import { Operation } from "~/services/types";

type Model = typeof db.passwordReset;
type PasswordResult<M extends Model, T, O extends Operation> = Promise<Prisma.Result<M, T, O>>;

interface IPasswordService {
  hashPassword(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
  generateReset<T extends Omit<Prisma.Args<Model, "create">, "data">>(
    username: string,
    args?: T,
  ): PasswordResult<Model, T, "create">;
  getResetByToken<T extends Prisma.Args<Model, "findUnique">>(
    token: string,
    args?: T,
  ): PasswordResult<Model, T, "findUnique">;
  getResetByUserId<T extends Prisma.Args<Model, "findFirst">>(
    userId: string,
    args?: T,
  ): PasswordResult<Model, T, "findFirst">;
  expireReset<T extends Prisma.Args<Model, "updateMany">>(
    token: string,
    args?: T,
  ): PasswordResult<Model, T, "updateMany">;
  deleteReset<T extends Prisma.Args<Model, "delete">>(token: string, args?: T): PasswordResult<Model, T, "delete">;
}

class Service implements IPasswordService {
  public async hashPassword(password: string) {
    return withServiceErrorHandling(async () => {
      const hash = await bcrypt.hash(password, 10);
      return hash;
    }) as Promise<string>;
  }

  public async compare(password: string, hash: string) {
    return withServiceErrorHandling(async () => {
      return bcrypt.compare(password, hash);
    }) as Promise<boolean>;
  }

  public async generateReset<T extends Omit<Prisma.Args<Model, "create">, "data">>(email: string, args?: T) {
    return withServiceErrorHandling<Model, T, "create">(async () => {
      const user = await db.user.findUnique({ where: { email } });
      const reset = await db.passwordReset.create({
        ...args,
        data: {
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          user: {
            connect: {
              id: user?.id,
            },
          },
        },
      });
      return reset as Prisma.Result<Model, T, "create">;
    });
  }

  public async getResetByToken<T extends Prisma.Args<Model, "findUnique">>(token: string, args?: T) {
    return withServiceErrorHandling<Model, T, "findUnique">(async () => {
      const reset = await db.passwordReset.findUnique({
        ...args,
        where: { token, ...args?.where },
      });
      return reset as Prisma.Result<Model, T, "findUnique">;
    });
  }

  public async getResetByUserId<T extends Prisma.Args<Model, "findFirst">>(userId: string, args?: T) {
    return withServiceErrorHandling<Model, T, "findFirst">(async () => {
      const reset = await db.passwordReset.findFirst({
        ...args,
        where: { userId, expiresAt: { gte: new Date() }, ...args?.where },
      });
      return reset as Prisma.Result<Model, T, "findFirst">;
    });
  }

  public async expireReset<T extends Prisma.Args<Model, "updateMany">>(token: string, args?: T) {
    return withServiceErrorHandling<Model, T, "updateMany">(async () => {
      const reset = await db.passwordReset.updateMany({
        ...args,
        where: { token, ...args?.where },
        data: { expiresAt: new Date(0), usedAt: new Date() },
      });
      return reset as Prisma.Result<Model, T, "updateMany">;
    });
  }

  public async deleteReset<T extends Prisma.Args<Model, "delete">>(id: string, args?: T) {
    return withServiceErrorHandling<Model, T, "delete">(async () => {
      const reset = await db.passwordReset.delete({ ...args, where: { id, ...args?.where } });
      return reset as Prisma.Result<Model, T, "delete">;
    });
  }
}

export const PasswordService = new Service();
