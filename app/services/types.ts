export type { Operation } from "@prisma/client/runtime/library";
export type RequireFields<T extends { data: unknown }, P extends keyof T["data"]> = T & {
  data: Required<Pick<T["data"], P>>;
};
export type OmitFromWhere<T extends { where: unknown }, P extends keyof T["where"]> = Omit<T, "where"> & {
  where?: Omit<T["where"], P>;
};
export type OmitFromData<T extends { data: unknown }, P extends keyof T["data"]> = Omit<T, "data"> & {
  data: Omit<T["data"], P>;
};
