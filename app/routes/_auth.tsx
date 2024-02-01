import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <>
      <header>Auth layout</header>
      <main className="mx-auto max-w-screen-sm px-6 pt-12">
        <Outlet />
      </main>
    </>
  );
}
