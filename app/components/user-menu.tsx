import { UserRole } from "@prisma/client";
import { Form, Link } from "@remix-run/react";

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
import { useUser } from "~/lib/utils";

export function UserMenu() {
  const user = useUser();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative mt-auto h-10 w-10 rounded-full">
            <span className="sr-only">Open User Menu</span>
            <Avatar aria-hidden="true">
              <AvatarFallback className="bg-primary text-primary-foreground dark:text-black" aria-hidden="true">
                <span>
                  {user.firstName?.charAt(0).toUpperCase()}
                  {user.lastName?.charAt(0).toUpperCase()}
                </span>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem className="px-0 py-0">
            <Form className="w-full" method="post" action="/logout" navigate={false}>
              <button className="w-full px-2 py-1.5 text-left">Log out</button>
            </Form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
