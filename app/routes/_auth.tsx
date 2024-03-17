import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <main className="flex min-h-full flex-col justify-center dark:bg-background md:bg-secondary">
      <div className="flex-1">
        <div className="mx-auto mt-40 w-full max-w-screen-md space-y-10">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
