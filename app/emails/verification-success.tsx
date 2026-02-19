import { Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

export default function VerificationSuccessEmail() {
  return (
    <EmailLayout preview="Your identity has been successfully verified">
      <Section>
        <Text className="m-0 text-center text-4xl">✅</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          Identity Verified Successfully
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          Your identity has been successfully verified. You can now claim a certificate from any course that requires
          identity verification.
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#f0fdf4] p-4">
        <Text className="m-0 text-center text-sm font-medium text-[#166534]">
          You&apos;re all set — no further action is needed.
        </Text>
      </Section>
    </EmailLayout>
  );
}
