import { redirect } from "react-router";

import { ErrorComponent } from "~/components/error-component";

export const loader = () => redirect("/preview");

export function ErrorBoundary() {
  return <ErrorComponent />;
}
