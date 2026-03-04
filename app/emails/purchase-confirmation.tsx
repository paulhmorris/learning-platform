import { Button, Section, Text } from "@react-email/components";

import Layout from "./components/email-layout";

type PurchaseConfirmationEmailProps = {
  firstName: string;
  courseName: string;
  courseUrl: string;
};

export default function PurchaseConfirmationEmail({
  firstName,
  courseName,
  courseUrl,
}: PurchaseConfirmationEmailProps) {
  return (
    <Layout preview={`Your enrollment in ${courseName} is confirmed`}>
      <Section>
        <Text className="m-0 text-center text-4xl">🎉</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          You&apos;re enrolled, {firstName}!
        </Text>
        <Text className="mt-2 text-balance text-center text-sm leading-6 text-[#52525b]">
          Your purchase of <strong>{courseName}</strong> is confirmed. You now have full access to all course materials.
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#f4f4f5] p-4">
        <Text className="m-0 text-sm leading-6 text-[#52525b]">
          <strong>Course:</strong> {courseName}
        </Text>
        <Text className="m-0 mt-1 text-sm leading-6 text-[#52525b]">
          <strong>Status:</strong> Ready to start
        </Text>
      </Section>

      <Section className="mt-4 text-center">
        <Button
          className="inline-block rounded-lg bg-[#18181b] px-6 py-3 text-center text-sm font-semibold text-white no-underline"
          href={courseUrl}
        >
          Start Learning
        </Button>
      </Section>
    </Layout>
  );
}
