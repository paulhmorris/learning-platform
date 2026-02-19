import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "~/emails/components/email-layout";

type CertificateReadyEmailProps = {
  firstName: string;
  courseName: string;
  downloadUrl: string;
};

export default function CertificateReadyEmail({ firstName, courseName, downloadUrl }: CertificateReadyEmailProps) {
  return (
    <EmailLayout preview={`Your ${courseName} certificate is ready to download`}>
      <Section>
        <Text className="m-0 text-center text-4xl">🎓</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          Congratulations, {firstName}!
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-[#52525b]">
          You&apos;ve successfully completed the <strong>{courseName}</strong> course. Your certificate is ready to
          download.
        </Text>
      </Section>

      <Section className="mt-4 text-center">
        <Button
          className="inline-block rounded-lg bg-[#18181b] px-6 py-3 text-center text-sm font-semibold text-white no-underline"
          href={downloadUrl}
        >
          Download Certificate
        </Button>
      </Section>

      <Text className="mt-6 text-center text-xs text-[#a1a1aa]">
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Text className="m-0 text-center text-xs text-[#3b82f6] underline">{downloadUrl}</Text>
    </EmailLayout>
  );
}
