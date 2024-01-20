import { Outlet } from "@remix-run/react";

export default function CourseLayout() {
  return (
    <div className="border border-destructive p-6">
      <p>Course Layout</p>
      <Outlet />
    </div>
  );
}
