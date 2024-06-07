// import { invokeTrigger } from "@trigger.dev/sdk";
// import { z } from "zod";

// import { db } from "~/integrations/db.server";
// import { client, triggerResend } from "~/integrations/trigger.server";
// import { COMPANY_NAME } from "~/lib/constants";
// import { UserService } from "~/services/UserService.server";

// export const verifyEmailJob = client.defineJob({
//   enabled: true,
//   id: "send-email-verification",
//   name: "Send Email Verification",
//   version: "0.0.1",
//   trigger: invokeTrigger({
//     schema: z.object({
//       email: z.string(),
//     }),
//   }),
//   integrations: {
//     resend: triggerResend,
//   },
//   run: async (payload, io) => {
//     // Generate a verification token
//     const token = (await io.random("generate-token", { min: 100000, max: 999999, round: true })).toString();

//     const user = await io.runTask("get-user", async () => {
//       return UserService.getByEmail(payload.email, { select: { id: true } });
//     });

//     if (!user) {
//       return io.logger.error("User not found", { email: payload.email });
//     }

//     // Create verification entry
//     await io.runTask("save-token", async () => {
//       return db.userVerification.upsert({
//         where: { userId: user.id },
//         create: {
//           expiresAt: new Date(Date.now() + 60 * 60 * 1000),
//           token,
//           user: {
//             connect: {
//               email: payload.email,
//             },
//           },
//         },
//         update: {
//           expiresAt: new Date(Date.now() + 60 * 60 * 1000),
//           token,
//         },
//       });
//     });

//     // Send email
//     await io.resend.emails.send("send-email-verification", {
//       from: `${COMPANY_NAME} <no-reply@getcosmic.dev>`,
//       to: payload.email,
//       subject: "Verify your email",
//       html: `<p>Here's your six digit verification code: <strong>${token}</strong></p>`,
//     });

//     return {
//       success: true,
//     };
//   },
// });
