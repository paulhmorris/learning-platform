import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import invariant from "tiny-invariant";
import ws from "ws";

import { PrismaClient } from "~/generated/prisma/client";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("Database");

export const singleton = <Value>(name: string, valueFactory: () => Value): Value => {
  const g = global as unknown as { __singletons: Record<string, unknown> };
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  g.__singletons ??= {};
  g.__singletons[name] ??= valueFactory();
  return g.__singletons[name] as Value;
};

function getPrismaClient() {
  const { DATABASE_URL } = process.env;
  invariant(typeof DATABASE_URL === "string", "DATABASE_URL env var not set");

  if (process.env.NODE_ENV !== "production") {
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
    void client.$connect();

    return client;
  }

  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon(
    {
      connectionString: DATABASE_URL,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
      query_timeout: 8_000,
    },
    { onPoolError: logPoolError },
  );
  return new PrismaClient({ adapter });
}

function logPoolError(error: Error) {
  logger.error("Database pool error", { error });
  Sentry.captureException(error);
}

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", getPrismaClient);

export { db };
