import { Outlet } from "@remix-run/react";

export default function CourseLayout() {
  return (
    <main className="border border-destructive p-6">
      <p>Course Layout</p>
      <Outlet />
    </main>
  );
}
