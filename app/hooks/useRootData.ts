import { useRouteLoaderData } from "react-router";

import { loader } from "~/root";

export function useRootData() {
  const data = useRouteLoaderData<typeof loader>("root");
  return data;
}
