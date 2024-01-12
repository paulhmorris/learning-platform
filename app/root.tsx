import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { Notifications } from "~/components/notifications";
import { themeSessionResolver } from "~/lib/session.server";
import { getGlobalToast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";
import stylesheet from "~/tailwind.css";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }, ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : [])];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await SessionService.getSession(request);
  const { getTheme } = await themeSessionResolver(request);

  return typedjson(
    {
      user: await SessionService.getUser(request),
      theme: getTheme(),
      serverToast: getGlobalToast(session),
    },
    {
      headers: {
        "Set-Cookie": await SessionService.commitSession(session),
      },
    },
  );
};

export default function AppWithProviders() {
  const { theme } = useTypedLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/resources/set-theme">
      <App />
    </ThemeProvider>
  );
}

function App() {
  const data = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <html lang="en" className={cn(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Links />
      </head>
      <body className="h-full min-h-full font-sans">
        <Outlet />
        <Notifications serverToast={data.serverToast} />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html lang="en">
      <head>
        <title>Oh no!</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>" />
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
