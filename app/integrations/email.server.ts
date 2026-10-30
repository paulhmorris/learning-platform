import type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";
import type React from "react";
import type { CreateEmailOptions, Resend } from "resend";

import { SERVER_CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("EmailService");

let resendClient: Resend | undefined;
async function getResend() {
  if (!resendClient) {
    const { Resend } = await import("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export type EmailAttachment = {
  content: Buffer;
  filename: string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string | Array<string>;
  subject: string;
  from?: string;
  attachments?: CreateEmailOptions["attachments"];
} & ({ html: string; react?: never } | { react: React.ReactNode; html?: never });

async function resolveHtml(props: SendEmailInput): Promise<string> {
  if (props.react) {
    const { render } = await import("@react-email/render");
    return await render(props.react);
  }
  if (props.html) {
    return props.html;
  }
  throw new Error("No content provided for email");
}

async function _sendSESEmail(props: SendEmailInput) {
  const html = await resolveHtml(props);
  const input: SendEmailCommandInput = {
    FromEmailAddress: props.from ?? `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}`,
    Destination: {
      ToAddresses: Array.isArray(props.to) ? props.to : [props.to],
    },
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: props.subject,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: html,
          },
        },
        Headers: [
          {
            Name: "X-Entity-Ref-ID",
            Value: nanoid(),
          },
        ],
      },
    },
  };

  if (SERVER_CONFIG.isProd) {
    try {
      const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
      const sesClient = new SESv2Client({ region: "us-east-1" });
      const response = await sesClient.send(new SendEmailCommand(input));
      if (!response.MessageId) {
        throw new Error("Email not sent");
      }

      return { messageId: response.MessageId, $metadata: response.$metadata };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error(`Failed to send email: ${errorMessage}`);
      Sentry.captureException(e);
      throw e;
    }
  }

  logger.info(
    `Email sent to ${Array.isArray(props.to) ? props.to.join(", ") : props.to} (Subject: "${props.subject}")`,
  );
  return { messageId: "test", $metadata: {} };
}

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

    if (response.error) {
      logger.error(`Failed to send email via Resend: ${response.error.message}`);
      Sentry.captureException(response.error);
    }

    return { messageId: response.data?.id };
  }

  logger.info(
    `Email sent to ${Array.isArray(props.to) ? props.to.join(", ") : props.to} (Subject: "${props.subject}")`,
  );
  return { messageId: "test" };
}

export const EmailService = {
  send: sendResendEmail,
};
