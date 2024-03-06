import { Outlet } from "@remix-run/react";

import { ErrorComponent } from "~/components/error-component";

export default function LessonLayout() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
