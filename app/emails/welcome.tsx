import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type WelcomeEmailProps = {
  firstName: string;
  baseUrl: string;
};

export default function WelcomeEmail({ firstName, baseUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Plumb Media & Education — let's get started">
      <Section>
        <Text className="m-0 text-center text-4xl">👋</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">Welcome, {firstName}!</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          Your account has been created and you&apos;re all set to start learning!
        </Text>
      </Section>

      <Section className="mt-4 text-center">
        <Button
          className="inline-block rounded-lg bg-[#18181b] px-6 py-3 text-center text-sm font-semibold text-white no-underline"
          href={baseUrl}
        >
          Browse Courses
        </Button>
      </Section>

      <Section className="mt-6 rounded-lg bg-[#f4f4f5] p-4">
        <Text className="m-0 text-center text-xs leading-5 text-[#71717a]">
          If you didn&apos;t create this account, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}
