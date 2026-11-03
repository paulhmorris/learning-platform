import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";

/**
 * Opens the database and Redis connections while the server build loads, so the first request
 * after a cold start reuses them instead of paying for the handshakes. Failures are ignored here
 * because the first real query reports them.
 */
export function warmUpConnections() {
  void db.$queryRaw`SELECT 1`.catch(() => undefined);
  void redis.ping().catch(() => undefined);
}
