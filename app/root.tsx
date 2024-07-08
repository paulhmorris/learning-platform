import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, json, useLoaderData, useRouteError } from "@remix-run/react";
import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix";
import { useEffect } from "react";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";

import "@fontsource-variable/inter/wght.css";
import { ErrorComponent } from "~/components/error-component";
import { GlobalLoader } from "~/components/global-loader";
import { Header } from "~/components/header";
import { Notifications } from "~/components/notifications";
import { Sentry } from "~/integrations/sentry";
import { themeSessionResolver } from "~/lib/session.server";
import { getGlobalToast, toast } from "~/lib/toast.server";
import { cn, hexToPartialHSL } from "~/lib/utils";
import { getCoursefromCMSForRoot, getLinkedCourseByHost } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";
import globalStyles from "~/tailwind.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: globalStyles, as: "style" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await SessionService.getSession(request);
  const user = await SessionService.getUser(request);
  const theme = (await themeSessionResolver(request)).getTheme();
  const serverToast = getGlobalToast(session);

  const defaultResponse = {
    user,
    theme,
    course: null,
    serverToast,
    ENV: {
      STRAPI_URL: process.env.STRAPI_URL,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
  };

  try {
    const { host } = new URL(request.url);
    const linkedCourse = await getLinkedCourseByHost(host);

    if (!linkedCourse) {
      return json(defaultResponse, {
        headers: {
          "Set-Cookie": await SessionService.commitSession(session),
        },
      });
    }

    const course = await getCoursefromCMSForRoot(linkedCourse.strapiId);

    return json(
      { ...defaultResponse, course },
      {
        headers: {
          "Set-Cookie": await SessionService.commitSession(session),
        },
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.json(request, defaultResponse, {
      type: "error",
      title: "Course not found",
      description: "Please try again later",
      position: "bottom-center",
    });
  }
};

function AppWithProviders() {
  const { theme } = useLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/set-theme">
      <App />
    </ThemeProvider>
  );
}

function App() {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme();

  useEffect(() => {
    if (data.user) {
      Sentry.setUser({
        id: data.user.id,
        email: data.user.email,
        username: data.user.email,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [data.user]);

  return (
    <html lang="en" className={cn(theme, "h-full")} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>"
        />
        {/* Set colors from CMS */}
        <style>
          {`
            :root {
              --primary: ${hexToPartialHSL(data.course?.data.attributes.primary_color) ?? "210 100% 40%"};
              --primary-foreground: ${hexToPartialHSL(data.course?.data.attributes.secondary_color) ?? "0 0% 100%"};
            }
          `}
        </style>
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Meta />
        <Links />
      </head>
      <body className={cn("flex h-full min-h-full flex-col bg-background font-sans text-foreground", theme)}>
        <Header />
        <Outlet />
        <Notifications />
        <GlobalLoader />
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
