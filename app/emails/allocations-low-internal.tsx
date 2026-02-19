import { Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type AllocationsLowInternalEmailProps = {
  courseName: string;
  courseId: string;
  remaining: number;
};

export default function AllocationsLowInternalEmail({
  courseName,
  courseId,
  remaining,
}: AllocationsLowInternalEmailProps) {
  const isExhausted = remaining === 0;

  return (
    <EmailLayout
      preview={
        isExhausted
          ? `Certificate allocations exhausted for ${courseName}`
          : `Certificate allocations running low for ${courseName}`
      }
    >
      <Section>
        <Text className="m-0 text-center text-4xl">{isExhausted ? "🚨" : "⚠️"}</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          {isExhausted ? "Allocations Exhausted" : "Allocations Running Low"}
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          {isExhausted
            ? `There are no remaining certificate allocations for this course. New certificates cannot be issued until more are added.`
            : `Certificate allocations for this course are running low. Please add more soon to avoid disruption.`}
        </Text>
      </Section>

      <Section className={`mt-2 rounded-lg p-4 ${isExhausted ? "bg-[#fef2f2]" : "bg-[#fffbeb]"}`}>
        <Text className="m-0 text-sm text-[#52525b]">
          <strong>Course:</strong> {courseName}
        </Text>
        <Text className="m-0 mt-1 text-sm text-[#52525b]">
          <strong>Course ID:</strong> {courseId}
        </Text>
        <Text className="m-0 mt-1 text-sm text-[#52525b]">
          <strong>Remaining Allocations:</strong>{" "}
          <span className={isExhausted ? "font-bold text-[#dc2626]" : "font-bold text-[#d97706]"}>{remaining}</span>
        </Text>
      </Section>
    </EmailLayout>
  );
}
