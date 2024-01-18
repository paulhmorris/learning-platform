import { Outlet } from "@remix-run/react";

export default function AccountLayout() {
  return (
    <div className="border-2 border-dashed border-red-700 p-6">
      <p>Account Layout</p>
      <Outlet />
    </div>
  );
}
