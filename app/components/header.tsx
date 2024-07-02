/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Link, useLocation, useRouteLoaderData } from "@remix-run/react";
import { Theme, useTheme } from "remix-themes";

import { ThemeModeToggle } from "~/components/theme-mode-toggle";
import { UserMenu } from "~/components/user-menu";
import { useOptionalUser } from "~/lib/utils";
import { loader } from "~/root";

export function Header() {
  const [theme] = useTheme();
  const user = useOptionalUser();
  const rootData = useRouteLoaderData<typeof loader>("root");
  const location = useLocation();

  if (["join", "login", "passwords"].includes(location.pathname.split("/")[1])) {
    return null;
  }

  const course = rootData?.course?.data?.attributes;
  const courseLogoUrl =
    theme === Theme.LIGHT ? course?.logo?.data?.attributes?.url : course?.dark_mode_logo?.data?.attributes?.url;
  const courseTitle = course?.title;

  return (
    <>
      <header className="sticky top-0 z-50 h-20 w-full border-b border-transparent bg-background px-6 py-6 text-foreground shadow-[0px_6px_39px_0px_#00000014] sm:px-10">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
          <Link to="/preview" className="block text-foreground">
            {courseLogoUrl ? (
              <img src={courseLogoUrl} alt={courseTitle ?? "Plumb Media & Education"} />
            ) : courseTitle ? (
              <span className="text-lg font-bold uppercase">{courseTitle}</span>
            ) : (
              <span className="text-lg font-bold uppercase">Plumb Media & Education</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              {user ? (
                <form action="/logout" method="post" className="blo">
                  <button className="rounded font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Logout
                  </button>
                </form>
              ) : (
                <Link to="/login">Log in</Link>
              )}
            </div>
            <ThemeModeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
