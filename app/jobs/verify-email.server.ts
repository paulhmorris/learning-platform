import { invokeTrigger } from "@trigger.dev/sdk";
import { z } from "zod";

import { db } from "~/integrations/db.server";
import { client, triggerResend } from "~/integrations/trigger.server";
import { COMPANY_NAME } from "~/lib/constants";

export const verifyEmailJob = client.defineJob({
  enabled: true,
  id: "send-email-verification",
  name: "Send Email Verification",
  version: "0.0.1",
  trigger: invokeTrigger({
    schema: z.object({
      email: z.string(),
    }),
  }),
  integrations: {
    resend: triggerResend,
  },
  run: async (payload, io) => {
    // Generate a verification token
    const token = (await io.random("generate-token", { min: 100000, max: 999999, round: true })).toString();

    // Create verification entry
    const verification = await io.runTask("save-token", async () => {
      return db.userVerification.create({
        data: {
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          token,
          user: {
            connect: {
              email: payload.email,
            },
          },
        },
      });
    });

    await io.logger.info("Generated token", { token: verification.token });

    // Send email
    await io.resend.emails.send("send-email-verification", {
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
