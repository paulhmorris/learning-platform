import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <div className="border-2 border-dashed border-pink-700">
      <header>Auth layout</header>
      <main className="p-24">
        <Outlet />
      </main>
    </div>
  );
}
