import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <>
      <header>Auth layout</header>
      <main className="p-6">
        <Outlet />
      </main>
    </>
  );
}
