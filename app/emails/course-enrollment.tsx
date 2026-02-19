import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type CourseEnrollmentEmailProps = {
  firstName: string;
  courseName: string;
  courseUrl: string;
};

export default function CourseEnrollmentEmail({ firstName, courseName, courseUrl }: CourseEnrollmentEmailProps) {
  return (
    <EmailLayout preview={`You've been enrolled in ${courseName}`}>
      <Section>
        <Text className="m-0 text-center text-4xl">📚</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          You&apos;ve Been Enrolled, {firstName}!
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          You&apos;ve been granted access to <strong>{courseName}</strong>. You can start learning right away.
        </Text>
      </Section>

      <Section className="mt-4 text-center">
        <Button
          className="inline-block rounded-lg bg-[#18181b] px-6 py-3 text-center text-sm font-semibold text-white no-underline"
          href={courseUrl}
        >
          Go to Course
        </Button>
      </Section>
    </EmailLayout>
  );
}
