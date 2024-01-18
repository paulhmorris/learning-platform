import { Prisma, User } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import bcrypt from "bcryptjs";

import { db } from "~/integrations/db.server";
import { withServiceErrorHandling } from "~/services/helpers";
import { PasswordService } from "~/services/PasswordService.server";
import { OmitFromData, OmitFromWhere, Operation } from "~/services/types";

type Model = typeof db.user;
type UserResult<T, O extends Operation> = Promise<Prisma.Result<Model, T, O>>;

interface IUserService {
  getById<T extends OmitFromWhere<Prisma.Args<Model, "findUnique">, "id">>(
    id: User["id"],
    args?: T,
  ): UserResult<T, "findUnique">;
  getByEmail<T extends OmitFromWhere<Prisma.Args<Model, "findUnique">, "email">>(
    email: User["email"],
    args?: T,
  ): UserResult<T, "findUnique">;
  resetOrSetupPassword<T extends Prisma.Args<Model, "update">>(args: {
    userId: User["id"];
    password: string;
  }): UserResult<T, "update">;
  create<T extends OmitFromData<Prisma.Args<Model, "create">, "email" | "password">>(
    email: User["email"],
    password: string,
    args?: T,
  ): UserResult<T, "create">;
  update<T extends OmitFromWhere<Prisma.Args<Model, "update">, "id">>(id: User["id"], args: T): UserResult<T, "update">;
  delete<T extends OmitFromWhere<Prisma.Args<Model, "delete">, "id">>(
    id: User["id"],
    args?: T,
  ): UserResult<T, "delete">;
  deleteByEmail<T extends OmitFromWhere<Prisma.Args<Model, "delete">, "id">>(
    email: User["email"],
    args?: T,
  ): UserResult<T, "delete">;
}

class Service implements IUserService {
  resetOrSetupPassword<T extends Prisma.UserUpdateArgs<DefaultArgs>>({
    userId,
    password,
  }: {
    userId: User["id"];
    password: string;
  }) {
    return withServiceErrorHandling<Model, T, "update">(async () => {
      const hashedPassword = await PasswordService.hashPassword(password);

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
      return user as Prisma.Result<Model, T, "update">;
    });
  }
  public async getById<T extends OmitFromWhere<Prisma.Args<Model, "findUnique">, "id">>(id: User["id"], args?: T) {
    return withServiceErrorHandling<Model, T, "findUnique">(async () => {
      const user = await db.user.findUnique({ ...args, where: { id, ...args?.where } });
      return user as Prisma.Result<Model, T, "findUnique">;
    });
  }

  public async getByEmail<T extends OmitFromWhere<Prisma.Args<Model, "findUnique">, "email">>(
    email: User["email"],
    args?: T,
  ) {
    return withServiceErrorHandling<Model, T, "findUnique">(async () => {
      const user = await db.user.findUnique({ ...args, where: { email, ...args?.where } });
      return user as Prisma.Result<Model, T, "findUnique">;
    });
  }

  public async create<T extends OmitFromData<Prisma.Args<Model, "create">, "email" | "password">>(
    email: User["email"],
    password: string,
    args?: T,
  ) {
    return withServiceErrorHandling<Model, T, "create">(async () => {
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await db.user.create({
        ...args,
        data: {
          ...args?.data,
          email,
          password: {
            create: {
              hash: hashedPassword,
            },
          },
        },
      });
      return user as Prisma.Result<Model, T, "create">;
    });
  }

  public async update<T extends OmitFromWhere<Prisma.Args<Model, "update">, "id">>(id: User["id"], args: T) {
    return withServiceErrorHandling<Model, T, "update">(async () => {
      const user = await db.user.update({ ...args, where: { id, ...args.where } });
      return user as Prisma.Result<Model, T, "update">;
    });
  }

  public async delete<T extends OmitFromWhere<Prisma.Args<Model, "delete">, "id">>(id: User["id"], args?: T) {
    return withServiceErrorHandling<Model, T, "delete">(async () => {
      const user = await db.user.delete({ ...args, where: { id, ...args?.where } });
      return user as Prisma.Result<Model, T, "delete">;
    });
  }

  public async deleteByEmail<T extends OmitFromWhere<Prisma.Args<Model, "delete">, "email">>(
    email: User["email"],
    args?: T,
  ) {
    return withServiceErrorHandling<Model, T, "delete">(async () => {
      const user = await db.user.delete({ ...args, where: { email, ...args?.where } });
      return user as Prisma.Result<Model, T, "delete">;
    });
  }
}

export const UserService = new Service();
