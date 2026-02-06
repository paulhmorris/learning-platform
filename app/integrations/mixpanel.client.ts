import mixpanel, { Config } from "mixpanel-browser";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

if (!MIXPANEL_TOKEN) {
  console.warn("Mixpanel token is not set. Analytics will be disabled.");
}

const initOptions: Partial<Config> = {
  debug: process.env.NODE_ENV === "development",
  autocapture: {
    pageview: false,
  },
  track_pageview: false,
  ignore_dnt: process.env.NODE_ENV === "development",
  record_sessions_percent: 100,
  record_mask_all_text: false,
};

let isInitialized = false;

function init() {
  if (window.ENV.VERCEL_ENV !== "production") {
    console.info("Mixpanel analytics is disabled in non-production environments.");
    return;
  }
  if (isInitialized) {
    return;
  }
  mixpanel.init(MIXPANEL_TOKEN, initOptions);
  isInitialized = true;
}

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  mixpanel.track(eventName, properties);
}

function trackPageView(url: string) {
  const parsed = new URL(url, window.location.origin);
  mixpanel.track_pageview({
    url: parsed.href,
    path: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  });
}

type AnalyticsUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function identifyUser(user: AnalyticsUser) {
  mixpanel.identify(user.id);
  mixpanel.people.set({
    $email: user.email ?? undefined,
    $first_name: user.firstName ?? undefined,
    $last_name: user.lastName ?? undefined,
  });
}

function clearUser() {
  mixpanel.reset();
}
export const Analytics = {
  init,
  trackEvent,
  trackPageView,
  identifyUser,
  clearUser,
};
