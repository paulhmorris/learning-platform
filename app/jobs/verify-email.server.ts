import { invokeTrigger } from "@trigger.dev/sdk";
import { z } from "zod";

import { COMPANY_NAME } from "~/config";
import { db } from "~/integrations/db.server";
import { client, triggerResend } from "~/integrations/trigger.server";

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
    const verification = await io.runTask("generate-token", async () => {
      return db.userVerification.create({
        data: {
          // 1 hour
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
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
      text: `Click this link to verify your email: ${process.env.SITE_URL}/verify-email/${verification.token}`,
    });

    return {
      success: true,
    };
  },
});
