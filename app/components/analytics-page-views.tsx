import { useLocation } from "@remix-run/react";
import { useEffect } from "react";

import { Analytics } from "~/integrations/analytics.client";

export function AnalyticsPageViews() {
  const location = useLocation();
  useEffect(() => void Analytics.capturePageView(), [location.pathname]);
  return null;
}
