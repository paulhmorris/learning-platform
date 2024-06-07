import { logger, task } from "@trigger.dev/sdk/v3";

import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { COMPANY_NAME } from "~/lib/constants";
import { UserService } from "~/services/UserService.server";

type Payload = {
  email: string;
};

export const verifyEmailJob = task({
  id: "send-email-verification",
  run: async (payload: Payload) => {
    // Generate a verification token
    // const token = (await io.random("generate-token", { min: 100000, max: 999999, round: true })).toString();
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await UserService.getByEmail(payload.email, { select: { id: true } });

    if (!user) {
      logger.error("User not found", { email: payload.email });
      return;
    }

    // Create verification entry
    await db.userVerification.upsert({
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

    // Send email
    await EmailService.send({
      from: `${COMPANY_NAME} <no-reply@getcosmic.dev>`,
      to: payload.email,
      subject: "Verify your email",
      html: `<p>Here's your six digit verification code: <strong>${token}</strong></p>`,
    });

    return {
      success: true,
    };
  },
});
