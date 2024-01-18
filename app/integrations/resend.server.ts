import { Resend as ResendConstructor } from "resend";

export const resend = new ResendConstructor(process.env.RESEND_API_KEY);
