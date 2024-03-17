import { NavLink, Outlet } from "@remix-run/react";
import React from "react";

import { ErrorComponent } from "~/components/error-component";
import { Header } from "~/components/header";
import { cn } from "~/lib/utils";

const links = [
  { href: "/account/profile", text: "Profile" },
  { href: "/account/password", text: "Password" },
  { href: "/account/payment-methods", text: "Payment" },
];

export default function AccountLayout() {
  return (
    <div
      className="h-full"
      style={
        {
          "--primary": "210 100% 40%",
          "--primary-foreground": "0 0% 100%",
        } as React.CSSProperties
      }
    >
      <Header />
      <div className="flex min-h-[calc(100%-80px)] flex-col justify-center dark:bg-background md:bg-secondary">
        <div className="flex-1">
          <div className="mx-auto w-full max-w-screen-md bg-background p-6 md:mt-40 md:rounded-xl md:p-12">
            <nav>
              <ul className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-muted p-1 text-muted-foreground">
                {links.map((link) => (
                  <li key={link.href}>
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                          isActive && "bg-background text-foreground shadow-sm",
                        )
                      }
                      to={link.href}
                    >
                      {link.text}
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
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
