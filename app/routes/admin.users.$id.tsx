import { LoaderFunctionArgs } from "@remix-run/node";
import { NavLink, Outlet } from "@remix-run/react";
import { IconCertificate, IconCreditCard, IconFingerprint, IconUserCircle } from "@tabler/icons-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { BackLink } from "~/components/common/back-link";
import { Badge } from "~/components/ui/badge";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

const links = [
  { href: "", text: "Profile", end: true, icon: <IconUserCircle className="size-[1.125rem]" /> },
  { href: "security", text: "Security", end: true, icon: <IconFingerprint className="size-[1.125rem]" /> },
  { href: "payment", text: "Payment", end: true, icon: <IconCreditCard className="size-[1.125rem]" /> },
  { href: "courses", text: "Courses", end: true, icon: <IconCertificate className="size-[1.125rem]" /> },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.id;
  if (!id) {
    throw notFound("User not found.");
  }

  try {
    const user = await db.user.findUniqueOrThrow({ where: { id }, include: { verification: true } });
    return typedjson({ user });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw toast.redirect(request, "/users", {
      type: "error",
      title: "Error fetching user",
      description: `An error occurred while fetching user ${id}.`,
    });
  }
}

export default function UsersIndex() {
  const { user } = useTypedLoaderData<typeof loader>();
  return (
    <>
      <BackLink to="/admin/users">Back to users</BackLink>
      <h1 className="text-3xl">{`${user.firstName} ${user.lastName}`}</h1>
      <Badge variant={user.verification ? "default" : "destructive"}>
        {user.verification ? "Verified" : "Unverified"}
      </Badge>
      <nav className="mt-4">
        <ul className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-muted p-1 text-muted-foreground">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink
                end={link.end}
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
    </>
  );
}
