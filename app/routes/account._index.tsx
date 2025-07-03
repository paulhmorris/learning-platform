import { redirect } from "react-router";

import { ErrorComponent } from "~/components/error-component";

export function loader() {
  throw redirect("/account/profile");
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
