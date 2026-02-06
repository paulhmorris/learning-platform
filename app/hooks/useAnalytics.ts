import { useUser } from "@clerk/react-router";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { Analytics } from "~/integrations/mixpanel.client";

export function useAnalytics() {
  const location = useLocation();
  const { user } = useUser();
  const initialized = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip analytics on the server
    if (typeof window === "undefined") {
      return;
    }

    const isPreProd = window.ENV.VERCEL_ENV !== "production";
    if (isPreProd) {
      return;
    }

    if (!initialized.current) {
      Analytics.init();
      initialized.current = true;
    }

    const pageUrl = `${location.pathname}${location.search}${location.hash}`;
    Analytics.trackPageView(pageUrl);
    lastPathRef.current = location.pathname;
  }, [location]);

  useEffect(() => {
    // Skip analytics on the server
    if (typeof window === "undefined") {
      return;
    }

    const isPreProd = window.ENV.VERCEL_ENV !== "production";
    if (isPreProd) {
      return;
    }

    if (!initialized.current) {
      return;
    }

    if (user) {
      Analytics.identifyUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      });

      if (!lastUserIdRef.current) {
        if (lastPathRef.current === "/sign-in") {
          Analytics.trackEvent("sign_in_completed");
        }
        if (lastPathRef.current === "/sign-up") {
          Analytics.trackEvent("sign_up_completed");
        }
      }

      lastUserIdRef.current = user.id;
    } else {
      Analytics.clearUser();
      lastUserIdRef.current = null;
    }
  }, [user]);

  return null;
}
