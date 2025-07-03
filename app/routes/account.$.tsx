import { UserProfile } from "@clerk/react-router";
import { IconCertificate, IconKey } from "@tabler/icons-react";
import { LoaderFunctionArgs, useLoaderData } from "react-router";

import { AccountCourses } from "~/components/account/courses";
import { IdentityVerification } from "~/components/account/identity-verification";
import { UserDebugTools } from "~/components/debug/user-debug-tools";
import { ErrorComponent } from "~/components/error-component";
import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
import { CourseService } from "~/services/course.server";
import { IdentityService } from "~/services/identity.server";
import { SessionService } from "~/services/session.server";

export const shouldRevalidate = () => false;

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);

  const [userCourses, cmsCourses, session] = await Promise.all([
    db.userCourses.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        isCompleted: true,
        completedAt: true,
        certificateClaimed: true,
        certificateS3Key: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            strapiId: true,
            host: true,
          },
        },
      },
    }),
    CourseService.getAll(),
    user.stripeVerificationSessionId
      ? await IdentityService.retrieveVerificationSession(user.stripeVerificationSessionId)
      : null,
  ]);

  if (!cmsCourses.length) {
    throw Responses.serverError();
  }

  const courses = userCourses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return { courses, userCourses, session };
}

export default function AccountLayout() {
  const { courses, userCourses, session } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center md:bg-secondary dark:bg-background">
        <main>
          <UserProfile>
            <UserProfile.Page label="Identity" labelIcon={<IconKey className="size-4" />} url="/identity">
              <IdentityVerification session={session} />
            </UserProfile.Page>
            <UserProfile.Page label="Courses" labelIcon={<IconCertificate className="size-4" />} url="/courses">
              <AccountCourses courses={courses} userCourses={userCourses} />
            </UserProfile.Page>
          </UserProfile>
        </main>
      </div>
      <UserDebugTools />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
