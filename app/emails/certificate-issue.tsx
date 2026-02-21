import { Section, Text } from "@react-email/components";

import { CONFIG } from "~/config";

import Layout from "./components/email-layout";

type CertificateIssueEmailProps = {
  firstName: string;
  courseName: string;
};

export default function CertificateIssueEmail({ firstName, courseName }: CertificateIssueEmailProps) {
  return (
    <Layout preview={`There was an issue creating your ${courseName} certificate`}>
      <Section>
        <Text className="m-0 text-center text-4xl">⚠️</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">We Hit a Snag, {firstName}</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          Congratulations on completing the <strong>{courseName}</strong> course! However, there was an issue on our end
          creating your certificate.
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#f4f4f5] p-4">
        <Text className="m-0 text-center text-sm leading-6 text-[#52525b]">
          Our team has been notified and is working on it. Your course is completed and{" "}
          <strong>your progress has been saved</strong>.
        </Text>
      </Section>

      <Text className="mt-4 text-center text-sm leading-6 text-[#52525b]">
        Feel free to reach out to{" "}
        <a href={`mailto:${CONFIG.supportEmail}`} className="text-[#3b82f6] no-underline">
          {CONFIG.supportEmail}
        </a>{" "}
        if you need further assistance.
      </Text>
    </Layout>
  );
}
