import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <>
      <main className="h-full dark:bg-background sm:bg-secondary">
        <div className="flex min-h-full flex-1 flex-col justify-center space-y-10">
          <Outlet />
        </div>
      </main>
    </>
  );
}
