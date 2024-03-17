import { Outlet } from "@remix-run/react";

import { Header } from "~/components/header";

export default function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
