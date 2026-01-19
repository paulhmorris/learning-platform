export const CONFIG = {
  supportEmail: "help@plumblearning.com",
  supportPhoneNumberRaw: "+14322668424",
  supportPhoneNumberFormatted: "(432) 266-8424",
};

export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
} as const;
export type UserRole = keyof typeof UserRole;
