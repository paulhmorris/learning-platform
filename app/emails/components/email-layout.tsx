import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

import { CONFIG } from "~/config";

type EmailLayoutProps = {
  preview: string;
  children: React.ReactNode;
};

export default function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-[520px] rounded-xl bg-white p-8 shadow-sm">
            <Section>
              <Text className="m-0 text-center text-xl font-bold tracking-tight text-[#18181b]">
                Plumb Media &amp; Education
              </Text>
            </Section>

            <Hr className="my-6 border-[#e4e4e7]" />

            {children}

            <Hr className="my-6 border-[#e4e4e7]" />

            <Section>
              <Text className="m-0 text-center text-xs leading-5 text-[#a1a1aa]">
                Need help? Contact us at{" "}
                <a href={`mailto:${CONFIG.supportEmail}`} className="text-[#a1a1aa] underline">
                  {CONFIG.supportEmail}
                </a>
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">
                &copy; {new Date().getFullYear()} Plumb Media &amp; Education. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
