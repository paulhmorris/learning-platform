import { SignUp } from "@clerk/react-router";
import { useEffect } from "react";

import { Analytics } from "~/integrations/mixpanel.client";

export default function SignUpPage() {
  useEffect(() => {
    Analytics.trackEvent("sign_up_started");
  }, []);

  return (
    <>
      <title>Sign Up | Plumb Media & Education</title>
      <div className="flex min-h-dvh w-dvw items-start justify-center pt-[clamp(2rem,10vw,5rem)]">
        <SignUp />
      </div>
    </>
  );
}
