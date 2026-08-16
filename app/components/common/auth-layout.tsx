import { ReactNode } from "react";

import { PageTitle } from "~/components/common/page-title";

const STEPS = [
  {
    title: "Step 1: Create your account",
    body: (variant: AuthLayoutProps["variant"]) =>
      `Use the ${variant === "sign-up" ? "sign-up" : "sign-in"} panel to the right — or below, on a smaller screen. We use Clerk to keep your login secure.`,
  },
  {
    title: "Step 2: Enroll in the course",
    body: () =>
      "Once your account is created you'll land on the course page, where you can browse every lesson before you pay. Select Enroll to continue to checkout.",
  },
  {
    title: "Step 3: Pay",
    body: () => "Checkout is handled securely by Stripe.",
  },
  {
    title: "Step 4: Begin the course!",
    body: () => null,
  },
];

interface AuthLayoutProps {
  variant: "sign-in" | "sign-up";
  children: ReactNode;
}

export function AuthLayout({ variant, children }: AuthLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-6 py-[clamp(2rem,10vw,5rem)]">
      <PageTitle className="text-center">Getting Started</PageTitle>
      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="text-2xl font-bold">How This Works</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map((step) => {
              const body = step.body(variant);
              return (
                <li key={step.title}>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  {body ? <p className="mt-1 text-base font-normal text-muted-foreground">{body}</p> : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  );
}
