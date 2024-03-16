import { UserRole } from "@prisma/client";
import { Link } from "@remix-run/react";

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
import { useOptionalUser } from "~/lib/utils";

export function UserMenu() {
  const user = useOptionalUser();

  if (!user) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative mt-auto h-10 w-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
        <DropdownMenuContent className="mb-2 w-40" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2 sm:space-y-1">
              <p className="text-base font-medium leading-none sm:text-sm">
                {user.firstName}
                {user.lastName ? ` ${user.lastName}` : null}
              </p>
              <p className="text-sm leading-none text-muted-foreground sm:text-xs">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer sm:hidden" to={user.role === UserRole.USER ? "/" : "/admin"}>
                Home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer" to={`/users/${user.id}`}>
                Profile
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
