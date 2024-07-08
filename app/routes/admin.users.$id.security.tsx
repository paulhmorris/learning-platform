import { MetaFunction, useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@vercel/remix";
import dayjs from "dayjs";
import { validationError } from "remix-validated-form";
import { useIsClient } from "usehooks-ts";
import { z } from "zod";

import { ActivateUserDialog } from "~/components/admin/security/activate-user-dialog";
import { DeactivateUserDialog } from "~/components/admin/security/deactivate-user-dialog";
import { AdminButton } from "~/components/ui/admin-button";
import { Badge } from "~/components/ui/badge";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { loader as userLayoutLoader } from "~/routes/admin.users.$id";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.id;
  if (!id) {
    throw notFound("User not found.");
  }

  try {
    const user = await db.user.findUniqueOrThrow({
      where: { id },
      select: {
        isActive: true,
        createdAt: true,
        password: {
          select: {
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        passwordResets: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return json({ user });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw error;
  }
}

const schema = withZod(
  z.object({
    resetId: z.string().optional(),
    _action: z.enum(["expire-password-reset", "deactivate-user", "activate-user"]),
  }),
);

export async function action({ request, params }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const result = await schema.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const userId = params.id;
  const { resetId, _action } = result.data;

  switch (_action) {
    case "expire-password-reset": {
      try {
        const reset = await db.passwordReset.update({
          where: { id: resetId },
          data: { expiresAt: new Date(0) },
        });
        return toast.json(
          request,
          { reset },
          {
            type: "success",
            title: "Reset expired",
            description: `Reset ${resetId} has been expired.`,
          },
        );
      } catch (error) {
        console.error(error);
        Sentry.captureException(error);
        return toast.json(
          request,
          { error },
          {
            type: "error",
            title: "Error expiring reset",
            description: `An error occurred while expiring reset ${resetId}.`,
          },
        );
      }
    }

    case "deactivate-user":
    case "activate-user": {
      try {
        const user = await db.user.update({
          where: { id: userId },
          data: { isActive: _action === "activate-user" ? true : false },
        });
        return toast.json(
          request,
          { user },
          {
            type: "success",
            title: "Success",
            description: `User has been ${_action === "deactivate-user" ? "de" : ""}activated.`,
          },
        );
      } catch (error) {
        console.error(error);
        Sentry.captureException(error);
        return toast.json(
          request,
          { error },
          {
            type: "error",
            title: "Error",
            description: `An error occurred while deactivating the user. ${error instanceof Error && error.message}`,
          },
        );
      }
    }
  }
}

export const meta: MetaFunction = () => {
  return [{ title: `User Security | Plumb Media & Education` }];
};

export default function AdminUserSecurity() {
  const layoutData = useRouteLoaderData<typeof userLayoutLoader>("routes/admin.users.$id");
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isClient = useIsClient();

  return (
    <>
      {user.isActive ? <DeactivateUserDialog /> : <ActivateUserDialog />}
      <div className="flex items-center gap-2">
        <fetcher.Form method="post" action="/api/reset-password">
          <input type="hidden" name="email" value={layoutData?.user.email} />
          <AdminButton
            type="submit"
            variant="link"
            className="-ml-3.5 w-auto sm:text-xs"
            disabled={fetcher.state !== "idle"}
          >
            Send Password {user.password ? "Reset" : "Setup"}
          </AdminButton>
        </fetcher.Form>
        {!layoutData?.user.isEmailVerified ? (
          <fetcher.Form method="post" action="/api/verification-code">
            <input type="hidden" name="email" value={layoutData?.user.email} />
            <AdminButton
              type="submit"
              variant="link"
              className="-ml-3.5 w-auto sm:text-xs"
              disabled={fetcher.state !== "idle"}
            >
              Send Email Verification
            </AdminButton>
          </fetcher.Form>
        ) : null}
      </div>
      <div className="mt-4 max-w-screen-sm space-y-8">
        <div className="max-w-64 space-y-1">
          <h2 className="text-base uppercase tracking-widest text-muted-foreground">User</h2>
          <p className="flex justify-between text-sm">
            <span className="text-muted-foreground">Created</span>
            {dayjs(user.createdAt).format("MM/DD/YY h:mma")}
          </p>
        </div>
        <div className="max-w-64 space-y-1">
          <h2 className="text-base uppercase tracking-widest text-muted-foreground">Password</h2>
          {user.password ? (
            <div>
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                {isClient ? dayjs(user.password.createdAt).format("MM/DD/YY h:mma") : null}
              </p>
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last updated</span>
                {isClient ? dayjs(user.password.updatedAt).format("MM/DD/YY h:mma") : null}
              </p>
            </div>
          ) : (
            <p className="text-sm">No password set</p>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <h2 className="text-base uppercase tracking-widest text-muted-foreground">Password Resets</h2>
            <p className="text-xs text-muted-foreground">10 most recent</p>
          </div>
          <ul className="max-w-md space-y-2">
            {user.passwordResets.map((r) => {
              const isActive = !r.usedAt && dayjs(r.expiresAt).isAfter(dayjs());
              const isExpired = dayjs(r.expiresAt).isBefore(dayjs());
              const isUsed = !!r.usedAt;

              return (
                <li key={r.id} className={"rounded border p-2"}>
                  <header className="mb-2 flex justify-between">
                    <Badge variant={isActive ? "success" : "secondary"}>
                      {isActive ? "Active" : isUsed ? "Used" : isExpired ? "Expired" : "Inactive"}
                    </Badge>
                    {isActive ? (
                      <fetcher.Form method="post" action={`/admin/users/${layoutData?.user.id}/security`}>
                        <input type="hidden" name="resetId" value={r.id} />
                        <AdminButton
                          type="submit"
                          variant="link"
                          className="-mx-3.5 -my-2.5 w-auto"
                          disabled={fetcher.state !== "idle"}
                          name="_action"
                          value="expire-password-reset"
                        >
                          Expire
                        </AdminButton>
                      </fetcher.Form>
                    ) : null}
                  </header>
                  <div className="space-y-1">
                    <p className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Requested</span>
                      <span>{isClient ? dayjs(r.createdAt).format("MM/DD/YY h:mma") : null}</span>
                    </p>
                    {!isExpired ? (
                      <p className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires</span>
                        <span>{isClient ? dayjs(r.expiresAt).format("MM/DD/YY h:mma") : null}</span>
                      </p>
                    ) : null}
                    {r.usedAt ? (
                      <p className="flex justify-between text-sm text-success">
                        <span>Used At</span>
                        <span>{isClient ? dayjs(r.usedAt).format("MM/DD/YY h:mma") : null}</span>
                      </p>
                    ) : null}
                    <p className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Token</span>
                      <span>{r.token}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
