import { z } from "zod";

export const CheckboxSchema = z
  .string()
  .transform((val) => val === "on")
  .or(z.undefined());
