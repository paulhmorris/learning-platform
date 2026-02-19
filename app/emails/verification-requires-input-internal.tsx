import { Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type VerificationRequiresInputInternalEmailProps = {
  userId: string;
};

export default function VerificationRequiresInputInternalEmail({
  userId,
}: VerificationRequiresInputInternalEmailProps) {
  return (
    <EmailLayout preview={`Identity verification requires input for user ${userId}`}>
      <Section>
        <Text className="mb-0 mt-0 text-lg font-semibold text-[#18181b]">Identity Verification Alert</Text>
        <Text className="mt-2 text-sm leading-6 text-[#52525b]">
          Identity verification requires additional input from the following user:
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#f4f4f5] p-4">
        <Text className="m-0 text-sm text-[#52525b]">
          <strong>User ID:</strong> {userId}
        </Text>
      </Section>

      <Text className="mt-4 text-sm leading-6 text-[#52525b]">
        Please review the verification session in the Stripe Dashboard.
      </Text>
    </EmailLayout>
  );
}
