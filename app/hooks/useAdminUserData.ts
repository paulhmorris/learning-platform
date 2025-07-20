import { useRouteLoaderData } from "react-router";

import type { loader } from "~/routes/admin.users.$id";

export function useAdminUserData() {
  const data = useRouteLoaderData<typeof loader>("routes/admin.users.$id");
  if (!data) {
    throw new Error(
      import.meta.env.DEV ? "useAdminUserData must be used within routes/admin/users.$id" : "Data not found",
    );
  }
  return data;
}
