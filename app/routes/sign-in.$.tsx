import { SignIn } from "@clerk/react-router";
import { useEffect } from "react";

import { AuthLayout } from "~/components/common/auth-layout";
import { useRootData } from "~/hooks/useRootData";
import { Analytics } from "~/integrations/mixpanel.client";
import { AUTH_PAGE_KEY } from "~/lib/constants";

export default function SignInPage() {
  const courseTitle = useRootData()?.course?.data.attributes.title;

  useEffect(() => {
    sessionStorage.setItem(AUTH_PAGE_KEY, "/sign-in");
    void Analytics.trackEvent("Sign In Started");
  }, []);

  return (
    <>
      <title>{`Sign In | ${courseTitle ?? "Plumb Media & Education"}`}</title>
      <AuthLayout variant="sign-in">
        <SignIn />
      </AuthLayout>
    </>
  );
}
