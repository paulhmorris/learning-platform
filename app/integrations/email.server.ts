import type React from "react";
import type { CreateEmailOptions, Resend } from "resend";

import { SERVER_CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("EmailService");

let resendClient: Resend | undefined;
async function getResend() {
  if (!resendClient) {
    const { Resend } = await import("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export type SendEmailInput = {
  to: string | Array<string>;
  subject: string;
  from?: string;
  attachments?: CreateEmailOptions["attachments"];
} & ({ html: string; react?: never } | { react: React.ReactNode; html?: never });

async function sendResendEmail(props: SendEmailInput) {
  if (SERVER_CONFIG.isProd) {
    const resend = await getResend();
    const response = await resend.emails.send({
      from: props.from ?? `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
      to: props.to,
      subject: props.subject,
      html: props.html ?? undefined,
      react: props.react ?? undefined,
      attachments: props.attachments,
    });

    // Resend returns errors rather than throwing.
    if (response.error) {
      throw new Error(`Failed to send email via Resend: ${response.error.message}`, { cause: response.error });
    }

    return { messageId: response.data.id };
  }

  logger.info(
    `Email sent to ${Array.isArray(props.to) ? props.to.join(", ") : props.to} (Subject: "${props.subject}")`,
  );
  return { messageId: "test" };
}

export const EmailService = {
  send: sendResendEmail,
};
