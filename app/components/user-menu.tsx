import { SignOutButton, useUser } from "@clerk/react-router";
import { Link, useMatches } from "react-router";

import { IconAvatar } from "~/components/icons";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { UserRole } from "~/config";
import { useRootData } from "~/hooks/useRootData";
import { Sentry } from "~/integrations/sentry";

export function UserMenu() {
  const { user } = useUser();
  const rootData = useRootData();
  const matches = useMatches();
  const shouldShowGoToCourse =
    matches.findIndex((m) => m.id.includes("$lessonSlug") || m.id.includes("preview")) === -1;

  const role = user?.publicMetadata.role;
  const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN;

  if (!user) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id="user-menu-button"
            className="relative mt-auto h-10 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="sr-only">Open User Menu</span>
            <Avatar aria-hidden="true">
              <AvatarFallback
                className="bg-transparent text-primary transition-colors hover:text-primary/90"
                aria-hidden="true"
              >
                <IconAvatar className="size-10" />
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mb-2 min-w-40 max-w-64" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2 sm:space-y-1">
              <p className="text-base font-medium leading-none sm:text-sm">
                {user.firstName}
                {user.lastName ? ` ${user.lastName}` : null}
              </p>
              <p className="truncate text-sm leading-none text-muted-foreground sm:text-xs">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer sm:hidden" to="/">
                Home
              </Link>
            </DropdownMenuItem>
            {rootData?.hasLinkedCourse && shouldShowGoToCourse ? (
              <DropdownMenuItem asChild>
                <Link className="cursor-pointer" to="/preview">
                  Go to Course
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer" to="/account">
                Account
              </Link>
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link className="cursor-pointer" to="/admin">
                  Admin
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="px-0 py-0">
            <SignOutButton redirectUrl="/sign-in">
              <button onClick={() => Sentry.setUser(null)} className="w-full cursor-pointer px-2 py-1.5 text-left">
                Log out
              </button>
            </SignOutButton>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
