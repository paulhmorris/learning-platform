import { Outlet } from "@remix-run/react";

export default function AppLayout() {
  return (
    <div className="border border-gray-500 p-4">
      <h1>App Layout</h1>
      <Outlet />
    </div>
  );
}
