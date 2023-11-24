import { Outlet } from "@remix-run/react";

export default function LessonLayout() {
  return (
    <div className="border-green-700-800 border p-6">
      <h1>Lesson Layout</h1>
      <Outlet />
    </div>
  );
}
