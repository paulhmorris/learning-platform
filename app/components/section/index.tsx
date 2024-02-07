import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  sectionTitle: string;
  durationInMinutes: number;
}

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <header {...props} className={cn("space-y-1", props.className)}>
      <h2 className="text-2xl">{props.sectionTitle}</h2>
      <p className="text-sm font-light">{props.durationInMinutes} min</p>
    </header>
  );
}

export function Section(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...props}
      className={cn("rounded-xl p-6 pb-8 shadow-[0px_8px_32px_0px_hsla(0,0%,0%,0.08)] dark:border", props.className)}
    ></section>
  );
}

export function SectionItemButton({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Button variant="secondary" className="ml-auto" asChild>
      <Link to={to}>{children}</Link>
    </Button>
  );
}

export function SectionItemTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium tracking-wide">{children}</h3>;
}

export function SectionItemIconContainer({ children }: { children: React.ReactNode }) {
  return <div className="flex basis-9 justify-start">{children}</div>;
}

export function SectionItemDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-light">{children}</p>;
}

export function SectionItemContainer({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn("flex items-center gap-2", props.className)}>
      {children}
    </div>
  );
}
