import type { Config, Mixpanel } from "mixpanel-browser";

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

let mixpanelInstance: Mixpanel | null = null;
let mixpanelLoadPromise: Promise<Mixpanel> | null = null;
let isInitialized = false;

function shouldSkipTracking(): boolean {
  return !isInitialized || !MIXPANEL_TOKEN || window.ENV.VERCEL_ENV !== "production";
}

async function loadMixpanel(): Promise<Mixpanel> {
  if (mixpanelInstance) {
    return mixpanelInstance;
  }

  if (mixpanelLoadPromise) {
    return mixpanelLoadPromise;
  }

  mixpanelLoadPromise = import("mixpanel-browser").then((module) => {
    mixpanelInstance = module.default;
    return module.default;
  });

  return mixpanelLoadPromise;
}

async function init() {
  if (window.ENV.VERCEL_ENV !== "production") {
    console.info("Mixpanel analytics is disabled in non-production environments.");
    return;
  }
  if (isInitialized) {
    return;
  }

  const mixpanel = await loadMixpanel();
  mixpanel.init(MIXPANEL_TOKEN, initOptions);
  isInitialized = true;
}

async function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (shouldSkipTracking()) {
    return;
  }
  const mixpanel = await loadMixpanel();
  mixpanel.track(eventName, properties);
}

async function trackPageView(url: string) {
  if (shouldSkipTracking()) {
    return;
  }
  const mixpanel = await loadMixpanel();
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

async function identifyUser(user: AnalyticsUser) {
  if (shouldSkipTracking()) {
    return;
  }
  const mixpanel = await loadMixpanel();
  mixpanel.identify(user.id);
  mixpanel.people.set({
    $email: user.email ?? undefined,
    $first_name: user.firstName ?? undefined,
    $last_name: user.lastName ?? undefined,
  });
}

async function clearUser() {
  if (shouldSkipTracking()) {
    return;
  }
  const mixpanel = await loadMixpanel();
  mixpanel.reset();
}
export const Analytics = {
  init,
  trackEvent,
  trackPageView,
  identifyUser,
  clearUser,
};
