import { Outlet } from "@remix-run/react";

export default function LessonLayout() {
  return (
    <div className="border-green-700-800 border p-6">
      <p>Lesson Layout</p>
      <Outlet />
    </div>
  );
}
