import { z } from "zod/v4";

export const CheckboxSchema = z
  .string()
  .transform((val) => val === "on")
  .or(z.undefined())
  .pipe(z.boolean());
