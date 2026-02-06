import { SignIn } from "@clerk/react-router";
import { useEffect } from "react";

import { Analytics } from "~/integrations/mixpanel.client";

export default function SignInPage() {
  useEffect(() => {
    Analytics.trackEvent("sign_in_started");
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
