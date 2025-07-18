import { redirect } from "react-router";

import { ErrorComponent } from "~/components/error-component";

export function loader() {
  throw redirect("/admin/courses");
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
