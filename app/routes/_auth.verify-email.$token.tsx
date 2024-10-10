import { Link } from "@remix-run/react";
import { json, LoaderFunctionArgs } from "@vercel/remix";

import { PageTitle } from "~/components/common/page-title";
import { db } from "~/integrations/db.server";
import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const paramToken = params.token;
  if (!paramToken) {
    throw badRequest("Token is required");
  }

  const token = await db.userVerification.findFirst({
    where: { token: paramToken },
    include: { user: true },
  });

  if (!token) {
    return Toasts.redirectWithError("/login", { title: "Invalid token" });
  }

  if (token.expiresAt < new Date()) {
    return Toasts.redirectWithError("/login", { title: "Token expired" });
  }

  await db.$transaction([
    db.userVerification.update({
      where: { id: token.id },
      data: { expiresAt: new Date() },
    }),
    db.user.update({
      where: { id: token.userId },
      data: { isEmailVerified: true },
    }),
  ]);

  return json({ success: true });
}

export default function VerifyEmail() {
  return (
    <div className="space-y-2 text-center">
      <PageTitle>Email Verified</PageTitle>
      <p>Your email has been verified!</p>
      <Link to="/login">Login</Link>
    </div>
  );
}
