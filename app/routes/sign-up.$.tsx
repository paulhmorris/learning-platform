import { SignUp } from "@clerk/react-router";
import { useEffect } from "react";

import { AuthLayout } from "~/components/common/auth-layout";
import { useRootData } from "~/hooks/useRootData";
import { Analytics } from "~/integrations/mixpanel.client";
import { AUTH_PAGE_KEY } from "~/lib/constants";

export default function SignUpPage() {
  const courseTitle = useRootData()?.course?.data.attributes.title;

  useEffect(() => {
    sessionStorage.setItem(AUTH_PAGE_KEY, "/sign-up");
    void Analytics.trackEvent("Sign Up Started");
  }, []);

  return (
    <>
      <title>{`Sign Up | ${courseTitle ?? "Plumb Media & Education"}`}</title>
      <AuthLayout variant="sign-up">
        <SignUp />
      </AuthLayout>
    </>
  );
}
