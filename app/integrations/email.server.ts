import type { SendEmailCommandInput, SendEmailCommandOutput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { PasswordReset, User } from "@prisma/client";
import { nanoid } from "nanoid";

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
    const url = new URL("/passwords/reset", process.env.SITE_URL ?? `https://${process.env.VERCEL_URL}`);
    url.searchParams.set("token", token);

    try {
      const data = await this.send({
        from: "Alliance 436 <alliance-436@alliance436.org>",
        to: email,
        subject: "Reset Your Password",
        html: `
          <p>Hi there,</p>
          <p>Someone requested a password reset for your Alliance 436 account. If this was you, please click the link below to reset your password. The link will expire in 15 minutes.</p>
          <p><a style="color:#976bff" href="${url.toString()}" target="_blank">Reset Password</a></p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
        `,
      });
      return { data };
    } catch (error) {
      return { error };
    }
  }

  static async sendPasswordSetup({ email, token }: PasswordEmailProps) {
    const url = new URL("/passwords/new", process.env.SITE_URL ?? `https://${process.env.VERCEL_URL}`);
    url.searchParams.set("token", token);

    try {
      const data = await this.send({
        from: "Alliance 436 <alliance-436@alliance436.org>",
        to: email,
        subject: "Setup Your Password",
        html: `
          <p>Hi there,</p>
          <p>Someone created an Alliance 436 account for you. Click the link below to setup a password. The link will expire in 15 minutes.</p>
          <p><a style="color:#976bff" href="${url.toString()}" target="_blank">Setup Password</a></p>
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
