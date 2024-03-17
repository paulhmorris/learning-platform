import { Link } from "@remix-run/react";

import { Logo } from "~/components/icons";
import { ThemeModeToggle } from "~/components/theme-mode-toggle";
import { UserMenu } from "~/components/user-menu";
import { useOptionalUser } from "~/lib/utils";

export function Header() {
  const user = useOptionalUser();
  return (
    <header className="sticky top-0 z-50 flex h-20 w-full items-center justify-between border-b border-transparent bg-background px-6 text-foreground shadow-[0px_6px_39px_0px_#00000014] dark:border-border sm:px-10">
      <Link to="/" className="block text-foreground">
        <Logo />
      </Link>
      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          {user ? (
            <form action="/logout" method="post" className="blo">
              <button className="rounded font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
    </header>
  );
}
