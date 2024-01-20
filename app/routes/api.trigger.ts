import { createRemixRoute } from "@trigger.dev/remix";

import { client } from "~/integrations/trigger.server";
export const { action } = createRemixRoute(client);

export * from "~/jobs/verify-email.server";
