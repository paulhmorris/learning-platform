/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

declare module "virtual:react-router/server-build" {
  export const routes: import("react-router").ServerBuild["routes"];
}
