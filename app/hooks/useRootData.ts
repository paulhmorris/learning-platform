import { useRouteLoaderData } from "@remix-run/react";

import { loader } from "~/root";

export function useRootData() {
  const data = useRouteLoaderData<typeof loader>("root");
  return data;
}
