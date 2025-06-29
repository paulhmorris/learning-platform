import "@fontsource-variable/inter/wght.css";
import { useEffect } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { data, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { getToast } from "remix-toast";

import { ErrorComponent } from "~/components/error-component";
import { GlobalLoader } from "~/components/global-loader";
import { Header } from "~/components/header";
import { Notifications } from "~/components/notifications";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { themeSessionResolver } from "~/lib/session.server";
import { hexToPartialHSL } from "~/lib/utils";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";
import globalStyles from "~/tailwind.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: globalStyles, as: "style" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.getUser(request);
  const theme = (await themeSessionResolver(request)).getTheme();
  const { toast, headers } = await getToast(request);

  const defaultResponse = {
    user,
    theme,
    course: null,
    toast,
    ENV: {
      STRAPI_URL: process.env.STRAPI_URL,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    },
  };

  try {
    const { host } = new URL(request.url);
    const linkedCourse = await CourseService.getByHost(host);

    if (!linkedCourse) {
      return data({ ...defaultResponse, hasLinkedCourse: false }, { headers });
    }

    const course = await CourseService.getFromCMSForRoot(linkedCourse.strapiId);

    return data({ ...defaultResponse, course, hasLinkedCourse: true }, { headers });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw notFound("Course not found");
  }
};

export default function AppWithProviders() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.user]);

  return (
    <html lang="en" data-theme={theme || "light"} className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        <meta name="git-sha" content={data.ENV.VERCEL_GIT_COMMIT_SHA} />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />

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
      <body className="flex h-full min-h-full flex-col bg-background font-sans text-foreground">
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

export function ErrorBoundary() {
  return (
    <html lang="en">
      <head>
        <title>Oh no!</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>"
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
