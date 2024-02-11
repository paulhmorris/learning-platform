import { Outlet } from "@remix-run/react";

export default function AppLayout() {
  return (
    <div className="px-6 pt-10 md:px-10 md:pt-14">
      <Outlet />
    </div>
  );
}
