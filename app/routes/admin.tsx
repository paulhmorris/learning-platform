import { NavLink, Outlet } from "@remix-run/react";
import { IconCertificate, IconUsersGroup } from "@tabler/icons-react";
import { LoaderFunctionArgs, json } from "@vercel/remix";
import { CSSProperties } from "react";

import { UserDebugTools } from "~/components/debug/user-debug-tools";
import { ErrorComponent } from "~/components/error-component";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

const links = [
  { href: "/admin/users", text: "Users", icon: <IconUsersGroup className="size-[1.125rem]" /> },
  { href: "/admin/courses", text: "Courses", icon: <IconCertificate className="size-[1.125rem]" /> },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  return json({});
}

export default function AdminLayout() {
  return (
    <div
      style={
        {
          "--primary": "210 100% 40%",
          "--primary-foreground": "0 0% 100%",
        } as CSSProperties
      }
    >
      <div className="flex min-h-[calc(100dvh-80px)] flex-col justify-center">
        <div className="flex-1">
          <div className="mx-auto w-full border border-transparent bg-background p-6 md:rounded-xl md:p-12">
            <nav>
              <ul className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-muted p-1 text-muted-foreground">
                {links.map((link) => (
                  <li key={link.href}>
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                          isActive ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50",
                        )
                      }
                      to={link.href}
                    >
                      {link.icon}
                      <span>{link.text}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <main className="mt-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
      <UserDebugTools />
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
