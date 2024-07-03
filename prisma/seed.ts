/* eslint-disable no-console */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "paul@remix.run";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("password", 10);

  const user = await prisma.user.create({
    data: {
      firstName: "Paul",
      lastName: "Henschel",
      role: UserRole.SUPERADMIN,
      email,
      isEmailVerified: true,
      isIdentityVerified: true,
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
