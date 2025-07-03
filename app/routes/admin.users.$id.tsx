import {
  IconCertificate,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconExternalLink,
  IconUserCircle,
  IconUserScan,
} from "@tabler/icons-react";
import { LoaderFunctionArgs, NavLink, Outlet, useLoaderData } from "react-router";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { Badge } from "~/components/ui/badge";
import { stripe } from "~/integrations/stripe.server";
import { Responses } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

const links = [
  { href: "", text: "Profile", end: true, icon: <IconUserCircle className="size-[1.125rem]" /> },
  { href: "courses", text: "Courses", end: false, icon: <IconCertificate className="size-[1.125rem]" /> },
];

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const id = args.params.id;
  if (!id) {
    throw Responses.notFound("User ID is required.");
  }

  const user = await UserService.getById(id);
  // TODO: Handle once clerkId is required
  if (!user?.clerkId) {
    throw Responses.notFound({ message: "User not found." });
  }

  let identityVerificationStatus;
  if (user.stripeVerificationSessionId) {
    const session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
    identityVerificationStatus = session.status;
  }

  return { user, identityVerificationStatus };
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
