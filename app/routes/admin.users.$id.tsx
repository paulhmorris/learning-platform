import { LoaderFunctionArgs, json } from "@remix-run/node";
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

import { BackLink } from "~/components/common/back-link";
import { Badge } from "~/components/ui/badge";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { notFound } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

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

  try {
    const user = await db.user.findUniqueOrThrow({ where: { id }, include: { verification: true } });
    let identityVerificationStatus;
    if (user.stripeVerificationSessionId) {
      const session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
      identityVerificationStatus = session.status;
    }
    return json({ user, identityVerificationStatus });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw error;
  }
}

export default function UsersIndex() {
  const { user, identityVerificationStatus } = useLoaderData<typeof loader>();
  return (
    <>
      <BackLink to="/admin/users">Back to users</BackLink>
      <h1 className="text-3xl">{`${user.firstName} ${user.lastName}`}</h1>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant={user.isActive ? "secondary" : "destructive"}>
          {user.isActive ? <IconCircleCheckFilled className="size-3.5" /> : <IconCircleXFilled className="size-3.5" />}
          <span>{user.isActive ? "Active" : "Inactive"}</span>
        </Badge>
        <Badge variant={user.verification ? "success" : "destructive"}>
          <IconMail strokeWidth={2.5} className="size-3.5" />
          <span>Email: {user.verification ? "Verified" : "Unverified"}</span>
        </Badge>
        <Badge variant={identityVerificationStatus === "verified" ? "success" : "destructive"}>
          <IconUserScan strokeWidth={2.5} className="size-3.5" />
          <span className="capitalize">Identity: {identityVerificationStatus?.split("_").join(" ") ?? "Unknown"}</span>
        </Badge>
        <a
          href={`https://dashboard.stripe.com/customers/${user.stripeId}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-500 inline-flex items-center gap-1.5 text-sm decoration-2 hover:underline"
        >
          <span className="leading-9">View on Stripe</span>
          <IconExternalLink className="size-3" />
        </a>
      </div>
      <nav className="mt-12">
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
