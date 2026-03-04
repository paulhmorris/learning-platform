import { Section, Text } from "@react-email/components";

import Layout from "./components/email-layout";

type HiphopExportFailureInternalEmailProps = {
  detail: string;
};

export default function HiphopExportFailureInternalEmail({ detail }: HiphopExportFailureInternalEmailProps) {
  return (
    <Layout preview="Hip Hop Driving Certificate Export Failed">
      <Section>
        <Text className="m-0 text-center text-4xl">🚨</Text>
        <Text className="mb-0 mt-4 text-center text-lg font-semibold text-[#18181b]">
          Hip Hop Driving Export Failed
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#52525b]">
          The daily Hip Hop Driving certificate export job failed and requires attention.
        </Text>
      </Section>

      <Section className="mt-2 rounded-lg bg-[#fef2f2] p-4">
        <Text className="m-0 text-sm text-[#52525b]">
          <strong>Details:</strong> {detail}
        </Text>
      </Section>

      <Text className="mt-4 text-sm leading-6 text-[#52525b]">
        Please check the logs in Trigger.dev and Sentry for more information.
      </Text>
    </Layout>
  );
}
