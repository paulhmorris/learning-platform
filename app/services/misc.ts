import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: "sk_test_iA1fvbE5On0ehVfbqq3IKUc5kiYUCuxHRpnof0sDGG" });

const userId = "user_2zD03Wztmx71wbXAEStmZ5i4BIk";
const externalId = "cm3kbh6qo0000qls5yn9lbk1l";

export async function run() {
  await clerkClient.users.updateUser(userId, { externalId });
}

await run();
