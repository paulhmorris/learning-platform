import { Outlet } from "@remix-run/react";

export default function AccountLayout() {
  return (
    <div className="border-red-700 p-6">
      <h1>Account Layout</h1>
      <Outlet />
    </div>
  );
}
