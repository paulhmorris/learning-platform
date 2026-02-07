import { useUser } from "@clerk/react-router";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { Analytics } from "~/integrations/mixpanel.client";
import { AUTH_PAGE_KEY } from "~/lib/constants";

export function useAnalytics() {
  const location = useLocation();
  const { user } = useUser();
  const initialized = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip analytics on the server
    if (typeof window === "undefined") {
      return;
    }

    // Skip analytics in non-production environments
    if (window.ENV.VERCEL_ENV !== "production") {
      return;
    }

    if (!initialized.current) {
      // Fire and forget - init is async but we don't need to wait for it
      void Analytics.init();
      initialized.current = true;
    }

    const pageUrl = `${location.pathname}${location.search}${location.hash}`;
    // Fire and forget - trackPageView is async but we don't need to wait for it
    void Analytics.trackPageView(pageUrl);
  }, [location]);

  useEffect(() => {
    // Skip analytics on the server
    if (typeof window === "undefined") {
      return;
    }

    // Skip analytics in non-production environments
    if (window.ENV.VERCEL_ENV !== "production") {
      return;
    }

    if (!initialized.current) {
      return;
    }

    if (user) {
      // Fire and forget - identifyUser is async but we don't need to wait for it
      void Analytics.identifyUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      });

      if (!lastUserIdRef.current) {
        const authPage = sessionStorage.getItem(AUTH_PAGE_KEY);
        // sessionStorage can only hold one value, so these conditions are mutually exclusive
        if (authPage === "/sign-in") {
          void Analytics.trackEvent("sign_in_completed");
          sessionStorage.removeItem(AUTH_PAGE_KEY);
        } else if (authPage === "/sign-up") {
          void Analytics.trackEvent("sign_up_completed");
          sessionStorage.removeItem(AUTH_PAGE_KEY);
        }
      }

      lastUserIdRef.current = user.id;
    } else {
      // Fire and forget - clearUser is async but we don't need to wait for it
      void Analytics.clearUser();
      lastUserIdRef.current = null;
    }
  }, [user]);

  return null;
}
