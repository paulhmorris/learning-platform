export const CONFIG = {
  supportEmail: "support@plumblearning.com",
};

export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
} as const;
export type UserRole = keyof typeof UserRole;
