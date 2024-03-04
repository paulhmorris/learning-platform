import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "@remix-run/react";
import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { Notifications } from "~/components/notifications";
import { themeSessionResolver } from "~/lib/session.server";
import { getGlobalToast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";
import stylesheet from "~/tailwind.css?url";

import "@fontsource-variable/inter/wght.css";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await SessionService.getSession(request);
  const { getTheme } = await themeSessionResolver(request);

  return typedjson(
    {
      user: await SessionService.getUser(request),
      theme: getTheme(),
      serverToast: getGlobalToast(session),
      ENV: {
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        STRAPI_URL: process.env.STRAPI_URL,
      },
    },
    {
      headers: {
        "Set-Cookie": await SessionService.commitSession(session),
      },
    },
  );
};

function AppWithProviders() {
  const { theme } = useTypedLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/set-theme">
      <App />
    </ThemeProvider>
  );
}

function App() {
  const data = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <html lang="en" className={cn("h-full", theme)} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Links />
      </head>
      <body className={cn("h-full min-h-dvh bg-background font-sans text-foreground", theme)}>
        <Outlet />
        {/* {data.user ? (
          <div className="fixed bottom-6 left-6 rounded border bg-background p-4 text-xs shadow-lg">
            <pre>{JSON.stringify(data.user, null, 2)}</pre>
          </div>
        ) : null} */}
        <Notifications />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export default withSentry(AppWithProviders);

export function ErrorBoundary() {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  return (
    <html lang="en">
      <head>
        <title>Oh no!</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
          <div className="-mb-10">
            <ErrorComponent />
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
