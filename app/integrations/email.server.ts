import type { SendEmailCommandInput, SendEmailCommandOutput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { PasswordReset, User } from "@prisma/client";
import { nanoid } from "nanoid";

import { EMAIL_FROM_DOMAIN } from "~/config";

const client = new SESv2Client({ region: "us-east-1" });

export type SendEmailInput = {
  from: string;
  to: string | Array<string>;
  subject: string;
  html: string;
};

type PasswordEmailProps = {
  email: NonNullable<User["email"]>;
  token: PasswordReset["token"];
};
export class EmailService {
  static async send(props: SendEmailInput) {
    return send(props);
  }

  static async sendPasswordReset({ email, token }: PasswordEmailProps) {
    const url = new URL("/passwords/new", process.env.SITE_URL);
    url.searchParams.set("token", token);

    try {
      const data = await this.send({
        from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
        to: email,
        subject: "Reset Your Password",
        html: `
          <p>To reset your Plumb Media & Education password, please click this link. The link will expire in 15 minutes.</p>
          <p><a style="text-decoration-line:underline;" href="${url.toString()}" target="_blank">${url.toString()}</a></p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
        `,
      });
      return { data };
    } catch (error) {
      return { error };
    }
  }
}

async function send(props: SendEmailInput) {
  const input: SendEmailCommandInput = {
    FromEmailAddress: props.from,
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
  const command = new SendEmailCommand(input);
  const response = await client.send(command);
  if (!response.MessageId) {
    throw new Error("Email not sent");
  }

  return { messageId: response.MessageId, $metadata: response.$metadata } as { messageId: string } & {
    $metadata: SendEmailCommandOutput["$metadata"];
  };
}
