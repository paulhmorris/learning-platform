import analytics, { EventName } from "posthog-js";

export const Analytics = {
  capturePageView() {
    return analytics.capture("$pageview");
  },

  captureEvent(event: EventName, properties?: Record<string, any>) {
    return analytics.capture(event, properties);
  },

  init() {
    analytics.init("phc_AVNMoWfRJRcihAtvYjvzkTF36rqEYWCecN60Lbnl4Ns", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
    });
  },
};
