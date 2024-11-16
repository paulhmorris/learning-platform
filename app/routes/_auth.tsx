/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Outlet } from "@remix-run/react";
import { Theme, useTheme } from "remix-themes";

import { useRootData } from "~/hooks/useRootData";

export default function AuthLayout() {
  const [theme] = useTheme();
  const rootData = useRootData();
  const course = rootData?.course?.data?.attributes;
  const courseLogoUrl =
    theme === Theme.DARK ? course?.dark_mode_logo?.data?.attributes?.url : course?.logo?.data?.attributes?.url;
  const courseTitle = course?.title;

  return (
    <div className="flex min-h-full flex-col dark:bg-background sm:bg-secondary">
      <main className="flex flex-col justify-center">
        <div className="flex-1">
          <div className="mx-auto w-full max-w-screen-sm space-y-4 sm:mt-40">
            <div className="flex justify-center rounded-lg p-6">
              {courseLogoUrl ? (
                <img
                  src={courseLogoUrl}
                  alt={courseTitle ?? "Plumb Media & Education"}
                  height={200}
                  className="h-20 rounded-lg lg:h-28"
                />
              ) : courseTitle ? (
                <h1 className="text-pretty text-center text-xl font-bold uppercase sm:text-4xl">{courseTitle}</h1>
              ) : (
                <h1 className="text-pretty text-center text-lg font-bold uppercase">Plumb Media & Education</h1>
              )}
            </div>
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="mt-auto">
        <div className="flex justify-center p-4 text-sm text-gray-500 dark:text-gray-400">
          <p className="text-xs">&copy; {new Date().getFullYear()} Plumb Media & Education</p>
        </div>
      </footer>
    </div>
  );
}
