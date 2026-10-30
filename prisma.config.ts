import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    /** Unpooled connection for migrations; optional so `prisma generate` works without a database. */
    url: process.env.DIRECT_URL,
  },
});
