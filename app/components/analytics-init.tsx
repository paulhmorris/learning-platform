import { useEffect } from "react";

import { Analytics } from "~/integrations/analytics.client";

export function AnalyticsInit() {
  useEffect(() => Analytics.init(), []);
  return null;
}
