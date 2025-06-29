import { Outlet } from "react-router";

import { ErrorComponent } from "~/components/error-component";

export default function LessonLayout() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
