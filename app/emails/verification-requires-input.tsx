import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type VerificationRequiresInputEmailProps = {
  baseUrl: string;
};

export default function VerificationRequiresInputEmail({ baseUrl }: VerificationRequiresInputEmailProps) {
  return (
    <EmailLayout preview="More information is needed to verify your identity">
      <Section>
        <Text className="m-0 text-center text-4xl">🔐</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          Action Required: Verify Your Identity
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          We need a bit more information to verify your identity. Please log in to your account to view the next steps
          and complete the verification process.
        </Text>
      </Section>

      <Section className="mt-4 text-center">
        <Button
          className="inline-block rounded-lg bg-[#18181b] px-6 py-3 text-center text-sm font-semibold text-white no-underline"
          href={baseUrl}
        >
          Log In to Continue
        </Button>
      </Section>
    </EmailLayout>
  );
}
