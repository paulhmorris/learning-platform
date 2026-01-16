import { useUser as useClerkUser } from "@clerk/react-router";

export function useOptionalUser() {
  const { user } = useClerkUser();
  return user ?? undefined;
}
