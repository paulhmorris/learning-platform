/* eslint-disable no-console */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { loadEnv } from "vite";

const prisma = new PrismaClient();
const env = loadEnv("", process.cwd(), "");
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

async function seed() {
  const email = "paul@remix.run";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("password", 10);

  const existingStripeCustomer = await stripe.customers.list({ email, limit: 1 });
  let stripeCustomerId = existingStripeCustomer.data[0]?.id;
  if (existingStripeCustomer.data.length === 0) {
    const stripeCustomer = await stripe.customers.create({
      email,
      name: "Paul Henschel",
    });
    stripeCustomerId = stripeCustomer.id;
  }

  await prisma.user.create({
    data: {
      firstName: "Paul",
      lastName: "Henschel",
      role: UserRole.SUPERADMIN,
      email,
      isEmailVerified: true,
      isIdentityVerified: true,
      stripeId: stripeCustomerId,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  await prisma.course.create({
    data: {
      strapiId: 1,
      stripePriceId: "price_1PP9UMJWTi6PPwsmDAPQTHvh",
      stripeProductId: "prod_QFenLoxmawFmBo",
      host: "localhost:3000",
      requiresIdentityVerification: true,
    },
  });

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
