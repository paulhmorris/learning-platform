/* eslint-disable no-console */
import { PrismaClient, UserRole } from "@prisma/client";

import { AuthService } from "~/services/auth.server";

const prisma = new PrismaClient();

async function seed() {
  const email = "paul@remix.run";
  const clerkUser = await AuthService.getUserList({ emailAddress: [email] });

  if (clerkUser.data.length > 1) {
    throw new Error(`Multiple users found with email ${email}. Please ensure only one user exists with this email.`);
  }

  const user = await prisma.user.create({
    data: {
      clerkId: clerkUser.data[0].id,
      role: UserRole.SUPERADMIN,
      isIdentityVerified: true,
    },
  });

  await prisma.course.create({
    data: {
      strapiId: 1,
      stripePriceId: "price_1PP9UMJWTi6PPwsmDAPQTHvh",
      stripeProductId: "prod_QFenLoxmawFmBo",
      host: "localhost:3000",
      requiresIdentityVerification: true,
      userCourses: {
        create: {
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      },
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
