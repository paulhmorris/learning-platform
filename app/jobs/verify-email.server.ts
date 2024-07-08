import { logger, task } from "@trigger.dev/sdk/v3";

import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { UserService } from "~/services/UserService.server";

type Payload = {
  email: string;
};

export const verifyEmailJob = task({
  id: "send-email-verification",
  run: async (payload: Payload) => {
    // Generate a verification token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    logger.info("Generated verification token", { token });

    const user = await UserService.getByEmail(payload.email, { select: { id: true } });

    if (!user) {
      logger.error("User not found", { email: payload.email });
      throw new Error("User not found");
    }

    logger.info("User found", { user: user });

    // Create verification entry
    const verification = await db.userVerification.upsert({
      where: { userId: user.id },
      create: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        token,
        user: {
          connect: {
            email: payload.email,
          },
        },
      },
      update: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        token,
      },
    });

    logger.info("Verification created", { verification });

    // Send email
    const messageId = await EmailService.send({
      from: "Plumb Learning <no-reply@plumblearning.com>",
      to: payload.email,
      subject: "Verify Your Email",
      html: `<p>Here's your six digit verification code: <strong>${token}</strong></p>`,
    });

    logger.info("Email sent", { messageId });

    return { success: true };
  },
});
