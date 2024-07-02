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
    <main className="flex min-h-full flex-col justify-center dark:bg-background md:bg-secondary">
      <div className="flex-1">
        <div className="mx-auto mt-40 w-full max-w-screen-sm space-y-10">
          <div className="flex justify-center">
            {courseLogoUrl ? (
              <img
                src={courseLogoUrl}
                alt={courseTitle ?? "Plumb Media & Education"}
                height={200}
                className="h-20 lg:h-28"
              />
            ) : courseTitle ? (
              <h1 className="text-pretty text-4xl font-bold uppercase">{courseTitle}</h1>
            ) : (
              <h1 className="text-lg font-bold uppercase">Plumb Media & Education</h1>
            )}
          </div>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
