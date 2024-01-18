import { Resend } from "@trigger.dev/resend";
import { TriggerClient } from "@trigger.dev/sdk";

export const client = new TriggerClient({
  id: "learning-platform-K4ZL",
  apiKey: process.env.TRIGGER_API_KEY,
  apiUrl: process.env.TRIGGER_API_URL,
});

export const triggerResend = new Resend({
  id: "resend",
  apiKey: process.env.RESEND_API_KEY,
});
