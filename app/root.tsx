import { ClerkProvider, RedirectToSignIn, SignedIn, SignedOut } from "@clerk/react-router";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";
import { dark } from "@clerk/themes";
import "@fontsource-variable/inter/wght.css";
import { useEffect } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { data, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from "react-router";
import { PreventFlashOnWrongTheme, Theme, ThemeProvider, useTheme } from "remix-themes";
import { getToast } from "remix-toast";

import { ErrorComponent } from "~/components/error-component";
import { GlobalLoader } from "~/components/global-loader";
import { Header } from "~/components/header";
import { Notifications } from "~/components/notifications";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { themeSessionResolver } from "~/lib/session.server";
import { cn, hexToPartialHSL } from "~/lib/utils";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";
import globalStyles from "~/tailwind.css?url";

// eslint-disable-next-line import/no-unresolved
import { Route } from "./+types/root";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: globalStyles, as: "style" }];

export const loader = async (args: LoaderFunctionArgs) => {
  const user = await SessionService.getUser(args.request);
  const theme = (await themeSessionResolver(args.request)).getTheme();
  const { toast, headers } = await getToast(args.request);

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
    return rootAuthLoader(args, async () => {
      const { host } = new URL(args.request.url);
      const linkedCourse = await CourseService.getByHost(host);

      if (!linkedCourse) {
        return data({ ...defaultResponse, hasLinkedCourse: false }, { headers });
      }

      const course = await CourseService.getFromCMSForRoot(linkedCourse.strapiId);

      return data({ ...defaultResponse, course, hasLinkedCourse: true }, { headers });
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw notFound("Course not found");
  }
};

export default function App({ loaderData }: Route.ComponentProps) {
  const [theme] = useTheme();
  return (
    <ClerkProvider
      loaderData={loaderData}
      appearance={{ baseTheme: theme === Theme.DARK ? dark : undefined }}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      telemetry={{ disabled: true }}
    >
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </ClerkProvider>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <ThemeProvider specifiedTheme={data?.theme ?? null} themeAction="/api/set-theme">
      <InnerLayout ssrTheme={Boolean(data?.theme)}>{children}</InnerLayout>
    </ThemeProvider>
  );
}

function InnerLayout({ ssrTheme, children }: { ssrTheme: boolean; children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const [theme] = useTheme();

  useEffect(() => {
    if (data?.user) {
      Sentry.setUser({
        id: data.user.id,
        email: data.user.email,
        username: data.user.email,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [data?.user]);

  return (
    <html lang="en" className={cn("h-full", theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
        {}
        {data?.ENV ? <meta name="git-sha" content={data.ENV.VERCEL_GIT_COMMIT_SHA} /> : null}

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Set colors from CMS */}
        <style>
          {`
            :root {
              --primary: ${hexToPartialHSL(data?.course?.data.attributes.primary_color) ?? "210 100% 40%"};
              --primary-foreground: ${hexToPartialHSL(data?.course?.data.attributes.secondary_color) ?? "0 0% 100%"};
            }
          `}
        </style>
        <PreventFlashOnWrongTheme ssrTheme={Boolean(ssrTheme)} />
        <Meta />
        <Links />
      </head>
      <body className="flex h-full min-h-full flex-col bg-background font-sans text-foreground">
        <Header />
        {children}
        <Notifications />
        <GlobalLoader />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data?.ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
      <div className="-mb-10">
        <ErrorComponent error={error} />
      </div>
    </main>
  );
}
