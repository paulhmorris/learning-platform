import { ClerkProvider, SignedIn, useUser } from "@clerk/react-router";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";
import { dark } from "@clerk/themes";
import "@fontsource-variable/inter/wght.css";
import { useEffect } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { data, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from "react-router";
import { PreventFlashOnWrongTheme, Theme, ThemeProvider, useTheme } from "remix-themes";
import { getToast } from "remix-toast";

import { ErrorComponent } from "~/components/error-component";
import { Header } from "~/components/header";
import { Notifications } from "~/components/notifications";
import { SERVER_CONFIG } from "~/config.server";
import { Sentry } from "~/integrations/sentry";
import { HttpHeaders, Responses } from "~/lib/responses.server";
import { cn, hexToPartialHSL } from "~/lib/utils";
import { themeSessionResolver } from "~/routes/api.set-theme";
import { CourseService } from "~/services/course.server";
import globalStyles from "~/tailwind.css?url";

// eslint-disable-next-line import/no-unresolved
import { Route } from "./+types/root";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: globalStyles, as: "style" }];

export const loader = async (args: LoaderFunctionArgs) => {
  const theme = (await themeSessionResolver(args.request)).getTheme();
  const { toast, headers: _headers } = await getToast(args.request);

  const defaultResponse = {
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

      const headers = new Headers(_headers);
      const TTL = SERVER_CONFIG.isProd ? 300 : 60;
      headers.set(HttpHeaders.CacheControl, `private, max-age=${TTL}`);

      if (!linkedCourse) {
        return data({ ...defaultResponse, hasLinkedCourse: false }, { headers });
      }

      const course = await CourseService.getFromCMSForRoot(linkedCourse.strapiId);

      return data({ ...defaultResponse, course, hasLinkedCourse: true }, { headers });
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw Responses.notFound();
  }
};

export default function App() {
  return <Outlet />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <ClerkProvider
      loaderData={data}
      telemetry={{ disabled: true }}
      appearance={{ theme: (data?.theme ?? null) === Theme.DARK ? dark : undefined }}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/preview"
      signUpForceRedirectUrl="/preview"
      signInFallbackRedirectUrl="/preview"
      signUpFallbackRedirectUrl="/preview"
    >
      <ThemeProvider specifiedTheme={data?.theme ?? null} themeAction="/api/set-theme">
        <InnerLayout ssrTheme={Boolean(data?.theme)}>{children}</InnerLayout>
      </ThemeProvider>
    </ClerkProvider>
  );
}

function InnerLayout({ ssrTheme, children }: { ssrTheme: boolean; children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const { user } = useUser();
  const [theme] = useTheme();

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? undefined,
        username: user.primaryEmailAddress?.emailAddress ?? undefined,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return (
    <html lang="en" data-theme={theme ?? ssrTheme} className={cn("h-full")}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#030712" />
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
        <SignedIn>
          <Header />
        </SignedIn>
        {children}
        <Notifications />
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
