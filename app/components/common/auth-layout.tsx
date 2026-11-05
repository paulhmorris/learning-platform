import { ClerkLoading, SignIn, SignUp } from "@clerk/react-router";
import { IconLoader } from "@tabler/icons-react";
import { useNavigation } from "react-router";

import { PageTitle } from "~/components/common/page-title";
import { Skeleton } from "~/components/ui/skeleton";
import { useRootData } from "~/hooks/useRootData";

const STEPS = [
  {
    title: "Step 1: Create your account",
    body: (variant: AuthLayoutProps["variant"]) => (
      <>
        Use the {variant} panel <span className="lg:hidden">below</span>
        <span className="hidden lg:inline">to the right</span>. We use Clerk to keep your login secure.
      </>
    ),
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

/** Clerk colors links with `colorPrimary`, which is unreadable for light course colors (e.g. yellow). */
const clerkLinkStyle = {
  color: "hsl(var(--foreground))",
  textDecoration: "underline",
};

interface AuthLayoutProps {
  variant: "sign-in" | "sign-up";
}

export function AuthLayout({ variant }: AuthLayoutProps) {
  const course = useRootData()?.course?.data.attributes;
  const courseTitle = course?.title;
  const navigation = useNavigation();
  /** Clerk navigates via React Router to its force-redirect URL (set in root.tsx) after a successful submit. */
  const isRedirecting = navigation.state !== "idle" && navigation.location?.pathname === "/preview";
  const appearance = {
    variables: {
      colorPrimary: course?.primary_color,
      colorPrimaryForeground: course?.secondary_color,
    },
    elements: {
      footerActionLink: clerkLinkStyle,
      formFieldAction: clerkLinkStyle,
      formResendCodeLink: clerkLinkStyle,
    },
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-6 py-6 lg:py-20">
      <PageTitle className="text-center text-2xl md:text-3xl lg:text-5xl">Getting Started</PageTitle>
      {courseTitle ? (
        <p className="mt-1 text-center text-base font-bold text-muted-foreground lg:mt-2 lg:text-2xl">{courseTitle}</p>
      ) : null}
      <div className="mt-6 grid gap-6 lg:mt-12 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div>
          <h2 className="text-lg font-bold lg:text-2xl">How This Works</h2>
          <ol className="mt-3 space-y-3 lg:mt-6 lg:space-y-6">
            {STEPS.map((step) => {
              const body = step.body(variant);
              return (
                <li key={step.title} className="border-l-4 border-primary pl-3 lg:pl-4">
                  <h3 className="text-sm font-bold lg:text-lg">{step.title}</h3>
                  {body ? (
                    <p className="mt-0.5 text-sm font-normal text-muted-foreground lg:mt-1 lg:text-base">{body}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex justify-center">
          <ClerkLoading>
            <ClerkCardSkeleton />
          </ClerkLoading>
          {variant === "sign-in" ? <SignIn appearance={appearance} /> : <SignUp appearance={appearance} />}
        </div>
      </div>
      {isRedirecting ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80">
          <IconLoader className="size-16 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : null}
    </div>
  );
}

function ClerkCardSkeleton() {
  return (
    <div className="w-full max-w-[25rem] space-y-6 rounded-xl border bg-card px-10 py-8 shadow-sm" aria-hidden>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mx-auto h-3 w-8" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mx-auto h-4 w-40" />
    </div>
  );
}
