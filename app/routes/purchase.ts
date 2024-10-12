import { LoaderFunctionArgs, redirect } from "@remix-run/node";

import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const url = new URL(request.url);

  const isSuccessful = url.searchParams.get("success") === "true";
  const stripeSessionId = url.searchParams.get("session_id");

  // If the purchase was not successful
  if (!isSuccessful) {
    return redirect("/preview?purchase_cancelled=true");
  }

  // If it's successful but for some reason there's no session id parameter
  if (!stripeSessionId) {
    return redirect("/preview?purchase_cancelled=true");
  }

  // Find the course that the user is trying to purchase
  const linkedCourse = await db.course.findUnique({ where: { host: url.host } });
  if (!linkedCourse) {
    return Toasts.redirectWithError("/", {
      title: "Course not found.",
      description: "Please try again later",
    });
  }

  // Retrieve the session from Stripe
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!session || session.payment_status === "unpaid") {
    return redirect("/preview?purchase_cancelled=true");
  }

  // Add the course to the user's courses
  await db.user.update({
    where: { id: user.id },
    data: {
      courses: {
        create: {
          courseId: linkedCourse.id,
        },
      },
    },
  });

  return redirect("/preview?purchase_success=true");
}
