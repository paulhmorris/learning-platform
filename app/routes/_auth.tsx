import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <div className="border-2 border-dashed border-pink-700">
      <p>Auth layout</p>
      <div className="p-24">
        <Outlet />
      </div>
    </div>
  );
}
