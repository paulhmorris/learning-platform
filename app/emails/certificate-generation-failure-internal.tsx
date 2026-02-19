import { Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type CertificateGenerationFailureInternalEmailProps = {
  userId: string;
  userCourseId: number;
  courseName: string;
  reason: string;
};

export default function CertificateGenerationFailureInternalEmail({
  userId,
  userCourseId,
  courseName,
  reason,
}: CertificateGenerationFailureInternalEmailProps) {
  return (
    <EmailLayout preview={`Certificate generation failed for user ${userId}`}>
      <Section>
        <Text className="m-0 text-center text-4xl">🚨</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          Certificate Generation Failed
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#52525b]">
          A certificate could not be generated and may require manual intervention. The user has not been notified.
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#fef2f2] p-4">
        <Text className="m-0 text-sm text-[#52525b]">
          <strong>User ID:</strong> {userId}
        </Text>
        <Text className="m-0 mt-1 text-sm text-[#52525b]">
          <strong>User Course ID:</strong> {userCourseId}
        </Text>
        <Text className="m-0 mt-1 text-sm text-[#52525b]">
          <strong>Course:</strong> {courseName}
        </Text>
        <Text className="m-0 mt-1 text-sm text-[#52525b]">
          <strong>Reason:</strong> {reason}
        </Text>
      </Section>

      <Text className="mt-4 text-sm leading-6 text-[#52525b]">
        Please check Sentry for more details and take corrective action.
      </Text>
    </EmailLayout>
  );
}
