import { Outlet } from "@remix-run/react";

export default function AppLayout() {
  return (
    <div className="flex gap-x-12 px-4 pt-10 md:flex-row md:pt-12">
      <Outlet />
    </div>
  );
}
