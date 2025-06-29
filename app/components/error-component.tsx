import { isRouteErrorResponse, useRouteError } from "react-router";

// import { captureRemixErrorBoundaryError } from "@sentry/remix";

export function ErrorComponent() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);
  // captureRemixErrorBoundaryError(error);

  const title = isRouteError ? error.statusText : "Unknown Error";
  let description = "An unknown error occurred.";

  if (isRouteError) {
    switch (error.status) {
      case 404:
        description = "Sorry, we couldn’t find the page you’re looking for.";
        break;
      case 401:
        description = "You are not authorized to view this page.";
        break;
      case 403:
        description = "You are not authorized to view this page.";
        break;
      case 500:
        description = "An error occurred on the server.";
        break;
      default:
        description = "An unknown error occurred.";
        break;
    }
  }
  return (
    <div className="p-6 sm:p-8">
      {isRouteError ? <p className="mb-2 text-base font-semibold text-destructive">{error.status}</p> : null}
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{description}</p>
      {error instanceof Error && error.stack ? (
        <>
          <p className="mt-24 text-left text-sm font-bold">Stack Trace</p>
          <pre className="whitespace-pre-wrap rounded bg-destructive/10 p-4 text-left text-xs text-destructive">
            <code>{error.stack}</code>
          </pre>
        </>
      ) : null}
    </div>
  );
}
