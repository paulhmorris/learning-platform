import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import {
  IconCertificate,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconExternalLink,
  IconFingerprint,
  IconMail,
  IconUserCircle,
  IconUserScan,
} from "@tabler/icons-react";
import { LoaderFunctionArgs, json } from "@vercel/remix";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { Badge } from "~/components/ui/badge";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { notFound } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/session.server";

const links = [
  { href: "", text: "Profile", end: true, icon: <IconUserCircle className="size-[1.125rem]" /> },
  { href: "security", text: "Security", end: true, icon: <IconFingerprint className="size-[1.125rem]" /> },
  // { href: "payment", text: "Payment", end: true, icon: <IconCreditCard className="size-[1.125rem]" /> },
  { href: "courses", text: "Courses", end: false, icon: <IconCertificate className="size-[1.125rem]" /> },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.id;
  if (!id) {
    throw notFound("User not found.");
  }

  const user = await db.user.findUnique({ where: { id }, include: { verification: true } });
  if (!user) {
    throw notFound({ message: "User not found." });
  }

  let identityVerificationStatus;
  if (user.stripeVerificationSessionId) {
    const session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
    identityVerificationStatus = session.status;
  }
  return json({ user, identityVerificationStatus });
}

export default function UsersIndex() {
  const { user, identityVerificationStatus } = useLoaderData<typeof loader>();
  return (
    <>
      <BackLink to="/admin/users">Back to users</BackLink>
      <h1 className="text-3xl">{`${user.firstName} ${user.lastName}`}</h1>
      <p className="text-xs text-muted-foreground">{user.email}</p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant={user.isActive ? "secondary" : "destructive"}>
          {user.isActive ? <IconCircleCheckFilled className="size-3.5" /> : <IconCircleXFilled className="size-3.5" />}
          <span>{user.isActive ? "Active" : "Inactive"}</span>
        </Badge>
        <Badge variant={user.isEmailVerified ? "success" : "destructive"}>
          <IconMail strokeWidth={2.5} className="size-3.5" />
          <span>Email: {user.isEmailVerified ? "Verified" : "Unverified"}</span>
        </Badge>
        <Badge variant={identityVerificationStatus === "verified" ? "success" : "destructive"}>
          <IconUserScan strokeWidth={2.5} className="size-3.5" />
          <span className="capitalize">Identity: {identityVerificationStatus?.split("_").join(" ") ?? "Unknown"}</span>
        </Badge>
        <a
          href={`https://dashboard.stripe.com/customers/${user.stripeId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#533AFD] decoration-2 hover:underline"
        >
          <span className="leading-9">View on Stripe</span>
          <IconExternalLink className="size-3.5 shrink-0" />
        </a>
      </div>
      <nav className="mt-8">
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
      <main className="mt-4">
        <Outlet />
      </main>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
