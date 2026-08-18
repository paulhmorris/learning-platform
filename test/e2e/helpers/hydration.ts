import type { Page } from "@playwright/test";

/**
 * Sonner's container is rendered by root's `<Notifications>` behind `<ClientOnly>`, so it only
 * exists once effects have run. Nothing else on the page is a reliable app-wide hydration marker.
 */
const HYDRATION_MARKER = 'section[aria-label*="Notifications"]';

/**
 * Navigates and waits for React to hydrate. Interacting before then submits forms natively, which
 * skips client validation, never opens dialogs, and loses the toast — the action's `Set-Cookie`
 * lands on the same response whose root loader already read the flash.
 */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(HYDRATION_MARKER, { state: "attached" });
}
