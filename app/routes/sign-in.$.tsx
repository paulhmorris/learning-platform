import { SignIn } from "@clerk/react-router";
import { useEffect } from "react";

import { Analytics } from "~/integrations/mixpanel.client";
import { AUTH_PAGE_KEY } from "~/lib/constants";

export default function SignInPage() {
  useEffect(() => {
    sessionStorage.setItem(AUTH_PAGE_KEY, "/sign-in");
    void Analytics.trackEvent("Sign In Started");
  }, []);

  return (
    <>
      <title>Sign In | Plumb Media & Education</title>
      <div className="flex min-h-dvh w-dvw items-start justify-center pt-[clamp(2rem,10vw,5rem)]">
        <SignIn />
      </div>
    </>
  );
}
