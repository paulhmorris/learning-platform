import type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";
import { Resend } from "resend";

import { CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("EmailService");

const resend = new Resend(process.env.RESEND_API_KEY);
const sesClient = new SESv2Client({ region: "us-east-1" });

export type SendEmailInput = {
  to: string | Array<string>;
  subject: string;
  html: string;
  from?: string;
};

async function _sendSESEmail(props: SendEmailInput) {
  const input: SendEmailCommandInput = {
    FromEmailAddress: props.from ?? `Plumb Media & Education <no-reply@${CONFIG.emailFromDomain}`,
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
            Data: props.html,
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

  if (CONFIG.isProd || CONFIG.isPreview) {
    try {
      const command = new SendEmailCommand(input);
      const response = await sesClient.send(command);
      if (!response.MessageId) {
        throw new Error("Email not sent");
      }

      return { messageId: response.MessageId, $metadata: response.$metadata };
    } catch (e) {
      logger.error(e instanceof Error ? e.message : "Unknown error");
      Sentry.captureException(e);
      throw e;
    }
  }

  logger.debug("Email sent", {
    From: props.from,
    To: props.to,
    Subject: props.subject,
  });
  return { messageId: "test", $metadata: {} };
}

async function sendResendEmail(props: SendEmailInput) {
  if (CONFIG.isProd || CONFIG.isPreview) {
    const response = await resend.emails.send({
      from: props.from ?? `Plumb Media & Education <no-reply@${CONFIG.emailFromDomain}>`,
      to: props.to,
      subject: props.subject,
      html: props.html,
    });

    if (response.error) {
      logger.error(response.error.message);
      Sentry.captureException(response.error);
    }

    return { messageId: response.data?.id };
  }

  logger.debug("Email sent", {
    From: props.from,
    To: props.to,
    Subject: props.subject,
  });
  return { messageId: "test" };
}

export const EmailService = {
  send: sendResendEmail,
};
