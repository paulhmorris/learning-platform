import { db } from "~/integrations/db.server";

import { ensureCourseHostForE2E } from "./progress";

/**
 * A 6-digit prefix unique to one test run. Specs share a course, so every allocation number they
 * create has to be unguessably distinct from the real data and from other workers' numbers.
 */
export function uniqueNumberPrefix() {
  return String(Math.floor(Math.random() * 900_000) + 100_000);
}

export async function createAllocations(courseId: string, numbers: Array<string>) {
  await db.certificateNumberAllocation.createMany({
    data: numbers.map((number) => ({ number, courseId })),
    skipDuplicates: true,
  });
}

export async function markAllocationUsed(courseId: string, number: string) {
  await db.certificateNumberAllocation.update({
    where: { courseId_number: { courseId, number } },
    data: { isUsed: true },
  });
}

/** Removes every allocation whose number starts with the prefix, used or not. */
export async function deleteAllocationsByPrefix(courseId: string, prefix: string) {
  await db.certificateNumberAllocation.deleteMany({ where: { courseId, number: { startsWith: prefix } } });
}

export async function getAllocationNumbers(courseId: string, prefix: string) {
  const allocations = await db.certificateNumberAllocation.findMany({
    where: { courseId, number: { startsWith: prefix } },
    select: { number: true },
  });
  return allocations.map((a) => a.number);
}

const DEFAULT_FORM_DATA = {
  firstName: "Jane",
  lastName: "Doe",
  middleInitial: "",
  street: "123 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  driversLicenseNumber: "1234567890",
  driversLicenseState: "TX",
  dateOfBirth: "01/01/2000",
  phoneNumber: "555-123-4567",
  gender: "F",
  reasonCode: "T",
  courtName: "Travis County",
};

/**
 * Puts a user in the state the amendment page expects: a completed course with an issued
 * certificate and the answers it was rendered from. Nothing here goes through the claim job.
 */
export async function seedIssuedCertificate(userId: string, options: { number: string; formData?: object } = { number: "" }) {
  const course = await ensureCourseHostForE2E();
  const formData = options.formData ?? DEFAULT_FORM_DATA;

  const userCourse = await db.userCourse.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id, isCompleted: true, completedAt: new Date() },
    update: { isCompleted: true, completedAt: new Date() },
  });

  await db.certificateNumberAllocation.upsert({
    where: { courseId_number: { courseId: course.id, number: options.number } },
    create: { courseId: course.id, number: options.number, isUsed: true },
    update: { isUsed: true },
  });

  await db.certificate.upsert({
    where: { userCourseId: userCourse.id },
    create: { userCourseId: userCourse.id, number: options.number, s3Key: `e2e/${options.number}.png` },
    update: { number: options.number, s3Key: `e2e/${options.number}.png`, isExported: null },
  });

  await db.preCertificationFormSubmission.upsert({
    where: { userCourseId: userCourse.id },
    create: { userCourseId: userCourse.id, formData },
    update: { formData },
  });

  return { courseId: course.id, userCourseId: userCourse.id };
}

/** Records a submitted pre-certification form without issuing a certificate. */
export async function seedFormSubmission(userId: string, formData: object = DEFAULT_FORM_DATA) {
  const course = await ensureCourseHostForE2E();
  const userCourse = await db.userCourse.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id },
    update: {},
  });

  await db.preCertificationFormSubmission.upsert({
    where: { userCourseId: userCourse.id },
    create: { userCourseId: userCourse.id, formData },
    update: { formData },
  });

  return { courseId: course.id, userCourseId: userCourse.id };
}

export async function cleanupCertificateDataForUser(userId: string) {
  const userCourses = await db.userCourse.findMany({ where: { userId }, select: { id: true } });
  const userCourseIds = userCourses.map((uc) => uc.id);

  await db.certificate.deleteMany({ where: { userCourseId: { in: userCourseIds } } });
  await db.preCertificationFormSubmission.deleteMany({ where: { userCourseId: { in: userCourseIds } } });
}
