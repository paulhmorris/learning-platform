/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Link, useLocation } from "@remix-run/react";
import { IconCertificate } from "@tabler/icons-react";

import {
  Section,
  SectionHeader,
  SectionItemContainer,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export function SectionCertificate({ isCourseCompleted }: { isCourseCompleted: boolean }) {
  const { pathname } = useLocation();

  return (
    <Section>
      <SectionHeader sectionTitle="Certificate" />
      <Separator className="my-4" />
      <div
        className={cn(
          "-my-1 block rounded-lg py-1",
          isCourseCompleted
            ? "text-foreground"
            : "text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400",
          pathname.includes("certificate") && "border border-[#e4e4e4] bg-muted p-2.5 motion-safe:transition-all",
        )}
      >
        <SectionItemContainer>
          <SectionItemIconContainer>
            <IconCertificate className={cn("h-7 w-6")} />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle>Certificate</SectionItemTitle>
          </div>
          {isCourseCompleted ? (
            <Button variant="secondary" className="ml-auto w-auto" asChild>
              <Link to="/certificate">Claim</Link>
            </Button>
          ) : (
            <Button variant="secondary" className="ml-auto w-auto" disabled>
              Claim
            </Button>
          )}
        </SectionItemContainer>
      </div>
    </Section>
  );
}
