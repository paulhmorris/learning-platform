import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { Theme, useTheme } from "remix-themes";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ThemeModeToggle() {
  const [theme, setTheme, { definedBy }] = useTheme();
  const isSystem = definedBy === "SYSTEM";
  const isLight = definedBy === "USER" && theme === Theme.LIGHT;
  const isDark = definedBy === "USER" && theme === Theme.DARK;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="icon" className="aspect-square transition-none">
          {theme === Theme.LIGHT ? <IconSun /> : <IconMoon />}
          <span className="sr-only">Set visual theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => setTheme(null)}>
          <div className="flex w-full items-center gap-x-2">
            <IconDeviceDesktop className="size-5" />
            <span>System</span>
            <div className="ml-auto" aria-label={isSystem ? "Current theme" : undefined}>
              {isSystem ? <IconCheck className="size-5" /> : null}
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(Theme.LIGHT)}>
          <div className="flex w-full items-center gap-x-2">
            <IconSun className="size-5" />
            <span>Light</span>
            <div className="ml-auto" aria-label={isLight ? "Current theme" : undefined}>
              {isLight ? <IconCheck className="size-5" /> : null}
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(Theme.DARK)}>
          <div className="flex w-full items-center gap-x-2">
            <IconMoon className="size-5" />
            <span>Dark</span>
            <div className="ml-auto" aria-label={isDark ? "Current theme" : undefined}>
              {isDark ? <IconCheck className="size-5" /> : null}
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    // <Button variant="icon" onClick={handleToggleTheme} className="aspect-square transition-none">
    //   <IconSun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
    //   <IconMoon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    //   <span className="sr-only">Toggle theme</span>
    // </Button>
  );
}
