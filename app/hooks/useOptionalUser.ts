import { useRouteLoaderData } from "react-router";

import { loader } from "~/root";

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof loader>("root");
  if (!data) {
    return undefined;
  }
  return data.user;
}
