/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Link, useLocation, useMatches, useRouteLoaderData } from "react-router";
import { Theme, useTheme } from "remix-themes";

import { ThemeModeToggle } from "~/components/theme-mode-toggle";
import { Button } from "~/components/ui/button";
import { UserMenu } from "~/components/user-menu";
import { useOptionalUser } from "~/lib/utils";
import { loader } from "~/root";

export function Header() {
  const [theme] = useTheme();
  const user = useOptionalUser();
  const rootData = useRouteLoaderData<typeof loader>("root");
  const location = useLocation();
  const matches = useMatches();

  if (["join", "login", "passwords"].includes(location.pathname.split("/")[1])) {
    return null;
  }

  const course = rootData?.course?.data?.attributes;
  const courseLogoUrl =
    theme === Theme.LIGHT ? course?.logo?.data?.attributes?.url : course?.dark_mode_logo?.data?.attributes?.url;
  const courseTitle = course?.title;
  const shouldShowGoToCourse =
    matches.findIndex((m) => m.id.includes("$lessonSlug") || m.id.includes("preview")) === -1;

  return (
    <>
      <header className="h-20 w-full border-b border-transparent bg-background px-6 py-4 text-foreground shadow-[0px_6px_39px_0px_#00000014] sm:px-10 sm:py-6">
        <div className="mx-auto flex w-full items-center justify-between">
          <Link to="/preview" className="block text-foreground">
            {courseLogoUrl ? (
              <img src={courseLogoUrl} alt={courseTitle ?? "Plumb Media & Education"} />
            ) : courseTitle ? (
              <span className="text-balance text-base font-bold sm:text-lg">{courseTitle}</span>
            ) : (
              <span className="text-lg font-bold uppercase">Plumb Media & Education</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            {rootData?.hasLinkedCourse && shouldShowGoToCourse ? (
              <Button asChild variant="secondary" className="hidden sm:block">
                <Link className="cursor-pointer" to="/preview">
                  Go to Course
                </Link>
              </Button>
            ) : null}
            {user ? null : (
              <div>
                <Link to="/login">Log in</Link>
              </div>
            )}
            <ThemeModeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
