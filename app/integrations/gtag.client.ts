function getGtag() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return null;
  return window.gtag;
}

function trackPageView(url: string) {
  const gtag = getGtag();
  if (!gtag) return;
  const parsed = new URL(url, window.location.origin);
  gtag("event", "page_view", {
    page_location: parsed.href,
    page_title: document.title,
  });
}

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("event", eventName, properties);
}

/** `set` applies to all subsequent events; re-running `config` would drop the course param set at page load. */
function setUserId(userId: string | null) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("set", { user_id: userId });
}

export const GoogleAnalytics = {
  trackPageView,
  trackEvent,
  setUserId,
};
