import { useUser } from "@clerk/react-router";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { Analytics } from "~/integrations/mixpanel.client";

const AUTH_PAGE_KEY = "mixpanel_auth_page";

export function useAnalytics() {
  const location = useLocation();
  const { user } = useUser();
  const initialized = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const isPreProd = window.ENV.VERCEL_ENV !== "production";

  useEffect(() => {
    if (isPreProd) {
      return;
    }

    if (!initialized.current) {
      Analytics.init();
      initialized.current = true;
    }

    const pageUrl = `${location.pathname}${location.search}${location.hash}`;
    Analytics.trackPageView(pageUrl);
  }, [location, isPreProd]);

  useEffect(() => {
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
        const authPage = sessionStorage.getItem(AUTH_PAGE_KEY);
        if (authPage === "/sign-in") {
          Analytics.trackEvent("sign_in_completed");
        } else if (authPage === "/sign-up") {
          Analytics.trackEvent("sign_up_completed");
        }
        sessionStorage.removeItem(AUTH_PAGE_KEY);
      }

      lastUserIdRef.current = user.id;
    } else {
      Analytics.clearUser();
      lastUserIdRef.current = null;
    }
  }, [user, isPreProd]);

  return null;
}
