/* eslint-disable no-console */
import { PrismaClient, UserRole } from "@prisma/client";

import { AuthService } from "~/services/auth.server";

const prisma = new PrismaClient();

async function seed() {
  const email = "paulh.morris@gmail.com";
  const clerkUser = await AuthService.getUserList({ emailAddress: [email] });

  if (clerkUser.data.length > 1) {
    throw new Error(`Multiple users found with email ${email}. Please ensure only one user exists with this email.`);
  }

  if (clerkUser.data.length === 0) {
    throw new Error(`No user found with email ${email}. Please create a user with this email in Clerk.`);
  }

  await prisma.user.create({
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
      issuesCertificate: true,
      userCourses: {
        create: {
          userId: clerkUser.data[0].id,
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
