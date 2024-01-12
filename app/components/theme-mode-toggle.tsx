import { IconMoon, IconSun } from "@tabler/icons-react";
import { Theme, useTheme } from "remix-themes";

import { Button } from "~/components/ui/button";

export function ThemeModeToggle() {
  const [_, setTheme] = useTheme();

  function handleToggleTheme() {
    setTheme((theme) => (theme === Theme.DARK ? Theme.LIGHT : Theme.DARK));
  }

  return (
    <Button variant="outline" size="icon" onClick={handleToggleTheme}>
      <IconSun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <IconMoon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
