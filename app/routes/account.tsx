import { NavLink, Outlet } from "@remix-run/react";
import { IconCreditCard, IconKey, IconUserCircle } from "@tabler/icons-react";

import { UserDebugTools } from "~/components/debug/user-debug-tools";
import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { cn } from "~/lib/utils";

const links = [
  { href: "/account/profile", text: "Profile", icon: <IconUserCircle className="size-[1.125rem]" /> },
  { href: "/account/password", text: "Password", icon: <IconKey className="size-[1.125rem]" /> },
  { href: "/account/payment-methods", text: "Payment", icon: <IconCreditCard className="size-[1.125rem]" /> },
  { href: "/account/courses", text: "Courses", icon: <IconCertificate className="size-[1.125rem]" /> },
];

export default function AccountLayout() {
  return (
    <>
      <div className="flex min-h-[calc(100dvh-80px)] flex-col justify-center md:bg-secondary dark:bg-background">
        <div className="flex-1">
          <div className="mx-auto w-full max-w-screen-md border border-transparent bg-background p-6 md:mt-40 md:rounded-xl md:p-12 dark:border-border">
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
                      <span className="sr-only sm:not-sr-only">{link.text}</span>
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
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
