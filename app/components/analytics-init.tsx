import { useEffect } from "react";

import { Analytics } from "~/integrations/analytics.client";

export function AnalyticsInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Analytics.init();
    }
  }, []);
  return null;
}
