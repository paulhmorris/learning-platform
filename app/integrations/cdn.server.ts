import { SERVER_CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("CdnClient");

const PURGE_URL_LIMIT = 30;

class CdnClient {
  /**
   * Evicts the given asset URLs from Cloudflare's edge cache.
   */
  async purge(urls: Array<string>) {
    if (urls.length === 0) {
      return;
    }

    if (SERVER_CONFIG.isDev || SERVER_CONFIG.isTest) {
      logger.info("Dev mode - skipping CDN cache purge", { urls });
      return;
    }

    if (urls.length > PURGE_URL_LIMIT) {
      throw new Error(`Cannot purge more than ${PURGE_URL_LIMIT} URLs in a single request`);
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_PURGE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: urls }),
      },
    );

    if (!response.ok) {
      throw new Error(`CDN cache purge failed: ${response.status} ${await response.text()}`);
    }

    logger.info("Purged CDN cache", { urls });
  }
}

export const CDN = new CdnClient();
