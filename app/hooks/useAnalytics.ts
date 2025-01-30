import { EventName } from "posthog-js";
import { usePostHog } from "posthog-js/react";

export function useAnalytics() {
  const analytics = usePostHog();

  function captureEvent(event: EventName, properties?: Record<string, any>) {
    return analytics.capture(event, properties);
  }

  return { captureEvent };
}
