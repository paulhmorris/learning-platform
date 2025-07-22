import type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";

import { CONFIG } from "~/config.server";
import { Sentry } from "~/integrations/sentry";

const client = new SESv2Client({ region: "us-east-1" });

export type SendEmailInput = {
  to: string | Array<string>;
  subject: string;
  html: string;
  from?: string;
};
export async function sendEmail(props: SendEmailInput) {
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
      const response = await client.send(command);
      if (!response.MessageId) {
        throw new Error("Email not sent");
      }

      return { messageId: response.MessageId, $metadata: response.$metadata };
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      throw e;
    }
  }

  console.debug(
    {
      From: props.from,
      To: props.to,
      Subject: props.subject,
    },
    "Email sent",
  );
  return { messageId: "test", $metadata: {} };
}

export const EmailService = {
  send: sendEmail,
};
