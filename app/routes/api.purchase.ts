import { LoaderFunctionArgs, redirect } from "react-router";

import { SERVER_CONFIG } from "~/config.server";
import PurchaseConfirmationEmail from "~/emails/purchase-confirmation";
import { EmailService } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { Toasts } from "~/lib/toast.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";
import { UserCourseService } from "~/services/user-course.server";

const logger = createLogger("Routes.Api.Purchase");

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const url = new URL(args.request.url);

  const isSuccessful = url.searchParams.get("success") === "true";
  const stripeSessionId = url.searchParams.get("session_id");

  // If the purchase was not successful
  if (!isSuccessful) {
    logger.info(`Purchase canceled`, { userId: user.id });
    return redirect("/preview?purchase_canceled=true");
  }

  // If it's successful but for some reason there's no session id parameter
  if (!stripeSessionId) {
    logger.warn(`No Stripe session ID provided`, { userId: user.id });
    return redirect("/preview?purchase_canceled=true");
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!session || session.payment_status === "unpaid") {
      logger.info(`Unpaid or missing Stripe session`, { userId: user.id });
      return redirect("/preview?purchase_canceled=true");
    }

    // Find the course that the user is trying to purchase
    const linkedCourse = await CourseService.getByHost(url.host);
    if (!linkedCourse) {
      logger.error(`Course not found for user`, { userId: user.id });
      return Toasts.redirectWithError("/", {
        message: "Course not found.",
        description: "Please try again later",
      });
    }

    // Enroll the user in the course
    await UserCourseService.enrollUser(user.id, linkedCourse.id);

    if (user.email) {
      const course = await CourseService.getFromCMSForRoot(linkedCourse.strapiId);
      const title = course?.data.attributes.title;
      const courseUrl = `https://${linkedCourse.host}/preview`;
      if (title) {
        try {
          await EmailService.send({
            to: user.email,
            from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
            subject: `You're enrolled in ${title}!`,
            react: PurchaseConfirmationEmail({
              firstName: user.firstName || "there",
              courseName: title,
              courseUrl,
            }),
          });
        } catch (error) {
          Sentry.captureException(error);
          logger.error(`Failed to send purchase confirmation email`, { error, userId: user.id });
        }
      }
    }

    return redirect("/preview?purchase_success=true");
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Failed to complete purchase`, { error, userId: user.id });
    return Toasts.redirectWithError("/", {
      message: "Unable to complete enrollment",
      description: "Please contact support if the issue persists",
    });
  }
}
