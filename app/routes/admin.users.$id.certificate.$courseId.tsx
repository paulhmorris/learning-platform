import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useEffect, useRef, useState } from "react";
import { ActionFunctionArgs, LoaderFunctionArgs, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { toast } from "sonner";
import * as z from "zod";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import {
  emptyHipHopDrivingCertificationValues,
  HiphopDrivingPreCertificateFields,
  hipHopDrivingCertificationSchema,
  HipHopDrivingCertificationValues,
} from "~/components/pre-certificate-forms/hiphopdriving";
import { Badge } from "~/components/ui/badge";
import { UncontrolledCheckbox } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { cms } from "~/integrations/cms.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { isResponseLike, Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { CertificateService } from "~/services/certificate.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";
import { APIResponseData } from "~/types/utils";

import { regenerateCertificateJob } from "../../jobs/regenerate-certificate";

const logger = createLogger("Routes.Admin.Users.Certificate");

const ASSET_BASE_URL = "https://assets.hiphopdriving.com";

const sendEmailSchema = z.object({
  sendEmail: z.stringbool().catch(false),
});

async function loadCertificateContext(userId: string, courseId: string) {
  const dbCourse = await CourseService.getById(courseId);
  const [cmsCourse, userCourse] = await Promise.all([
    cms.findOne<APIResponseData<"api::course.course">>("courses", dbCourse.strapiId, { fields: ["title"] }),
    CertificateService.getForRegenerationByUserAndCourse(userId, courseId),
  ]);

  return { courseName: cmsCourse.data.attributes.title, userCourse };
}

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const userId = args.params.id;
  const courseId = args.params.courseId;

  if (!userId || !courseId) {
    throw Responses.notFound();
  }

  try {
    const { courseName, userCourse } = await loadCertificateContext(userId, courseId);

    if (!userCourse?.certificate) {
      logger.warn(`No issued certificate for user ${userId} in course ${courseId}`, { userId, courseId });
      throw Responses.notFound();
    }

    // Fall back to blank fields so an admin can repair a submission that no longer parses
    // instead of being locked out of the form by it.
    const parsed = hipHopDrivingCertificationSchema.safeParse(userCourse.preCertificationFormSubmission?.formData);
    if (!parsed.success) {
      logger.warn(`Pre-certification submission for user course ${userCourse.id} is missing or invalid`, {
        userCourseId: userCourse.id,
      });
    }

    return {
      courseName,
      certificate: userCourse.certificate,
      defaultValues: parsed.success
        ? (parsed.data as HipHopDrivingCertificationValues)
        : emptyHipHopDrivingCertificationValues({ firstName: null, lastName: null, phone: null }),
      hasValidSubmission: parsed.success,
    };
  } catch (error) {
    if (isResponseLike(error)) {
      throw error;
    }
    Sentry.captureException(error, { extra: { userId, courseId } });
    logger.error(`Failed to load certificate for user ${userId} in course ${courseId}`, { userId, courseId });
    throw Responses.serverError();
  }
}

export async function action(args: ActionFunctionArgs) {
  const admin = await SessionService.requireAdmin(args);
  const userId = args.params.id;
  const courseId = args.params.courseId;

  if (!userId || !courseId) {
    return Toasts.dataWithError({ ok: false }, { message: "Error", description: "User and course are required." });
  }

  try {
    const { courseName, userCourse } = await loadCertificateContext(userId, courseId);

    if (!userCourse?.certificate) {
      return Toasts.dataWithError(
        { ok: false },
        { message: "Error", description: "This user has no issued certificate for this course." },
      );
    }

    // Read the body once: the answers and the email toggle are validated by separate schemas.
    const formData = await args.request.formData();
    const [answers, options] = await Promise.all([
      parseFormData(formData, hipHopDrivingCertificationSchema),
      parseFormData(formData, sendEmailSchema),
    ]);

    if (answers.error) {
      return validationError(answers.error);
    }

    const sendEmail = options.error ? false : options.data.sendEmail;

    logger.info(`Admin ${admin.id} amended certificate ${userCourse.certificate.number}`, {
      adminId: admin.id,
      userId,
      courseId,
      userCourseId: userCourse.id,
      certificateNumber: userCourse.certificate.number,
      wasExportedAt: userCourse.certificate.isExported,
      previousFormData: userCourse.preCertificationFormSubmission?.formData,
      newFormData: answers.data,
      sendEmail,
    });

    await CertificateService.amendFormSubmission({ userCourseId: userCourse.id, formData: answers.data });

    const job = await regenerateCertificateJob.trigger({
      userCourseId: userCourse.id,
      courseName,
      sendEmail,
    });

    logger.info(`Certificate regeneration job ${job.id} initiated for user course ${userCourse.id}`);

    // The token is scoped to this run; the client subscribes to it and reports the real outcome,
    // so no toast from here.
    return { ok: true as const, runId: job.id, publicAccessToken: job.publicAccessToken, sendEmail };
  } catch (error) {
    Sentry.captureException(error, { extra: { userId, courseId } });
    logger.error(`Failed to amend certificate for user ${userId} in course ${courseId}`, { userId, courseId });
    return Toasts.dataWithError(
      { ok: false },
      { message: "Error", description: "Failed to regenerate the certificate. Please try again." },
    );
  }
}

/** Statuses a run never leaves, so the toast can settle. */
const TERMINAL_STATUSES = [
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
] as const;

// A dropped subscription would otherwise leave the toast spinning forever.
const WATCH_TIMEOUT_MS = 120_000;

type WatchedRun = { runId: string; accessToken: string };

export default function AdminUserCertificate() {
  const { courseName, certificate, defaultValues, hasValidSubmission } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [watchedRun, setWatchedRun] = useState<WatchedRun | null>(null);
  const startedRunRef = useRef<string | null>(null);
  const settleRef = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  // Hand the toast a promise up front and settle it from the realtime subscription below.
  useEffect(() => {
    const data = fetcher.data;
    if (!data || !("runId" in data) || startedRunRef.current === data.runId) {
      return;
    }
    startedRunRef.current = data.runId;

    const promise = new Promise<void>((resolve, reject) => {
      settleRef.current = { resolve, reject };
    });

    const timeout = setTimeout(() => {
      settleRef.current?.reject(
        new Error("Regeneration is taking longer than expected. Refresh in a moment to check on it."),
      );
      settleRef.current = null;
      setWatchedRun(null);
    }, WATCH_TIMEOUT_MS);

    toast.promise(promise, {
      loading: "Regenerating certificate…",
      success: () => {
        void revalidator.revalidate();
        return data.sendEmail
          ? "Certificate updated and emailed to the student."
          : "Certificate updated. The download link now serves the corrected file.";
      },
      error: (error: Error) => error.message,
      duration: 20_000,
      finally: () => clearTimeout(timeout),
    });

    setWatchedRun({ runId: data.runId, accessToken: data.publicAccessToken });
  }, [fetcher.data, revalidator]);

  const { run, error } = useRealtimeRun<typeof regenerateCertificateJob>(watchedRun?.runId, {
    accessToken: watchedRun?.accessToken,
    enabled: Boolean(watchedRun),
  });

  // Settle on the run status rather than the hook's onComplete callback, which has been reported to
  // fire on non-terminal statuses and would report success before the file is rewritten.
  useEffect(() => {
    const settle = settleRef.current;
    if (!settle) {
      return;
    }

    if (error) {
      settleRef.current = null;
      setWatchedRun(null);
      settle.reject(new Error("Lost track of the regeneration. Refresh in a moment to check on it."));
      return;
    }

    // Ignore a lingering run from a previous submission, whose terminal status would settle this
    // promise before its own run has finished.
    if (!run || run.id !== watchedRun?.runId || !TERMINAL_STATUSES.some((s) => s === run.status)) {
      return;
    }

    settleRef.current = null;
    setWatchedRun(null);
    if (run.status === "COMPLETED") {
      settle.resolve();
    } else {
      settle.reject(
        new Error(`Regeneration ${run.status.toLowerCase().replace(/_/g, " ")}. The old certificate is intact.`),
      );
    }
  }, [run, error, watchedRun]);

  return (
    <>
      <title>Edit Certificate | Plumb Media & Education</title>
      <BackLink to="../courses">Back to courses</BackLink>
      <h1 className="text-2xl">Edit Certificate</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {courseName} • Certificate #{certificate.number} • Issued {new Date(certificate.issuedAt).toLocaleDateString()}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={certificate.isExported ? "success" : "outline"}>
          {certificate.isExported
            ? `Reported to the state ${new Date(certificate.isExported).toLocaleDateString()}`
            : "Not yet reported to the state"}
        </Badge>
        {certificate.s3Key ? (
          <a
            href={`${ASSET_BASE_URL}/${certificate.s3Key}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline decoration-2"
          >
            Download current certificate
          </a>
        ) : null}
      </div>

      {!hasValidSubmission ? (
        <p className="mt-4 max-w-screen-md rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
          This student&apos;s pre-certification answers are missing or no longer valid, so the fields below start blank.
          Fill them in completely before regenerating.
        </p>
      ) : null}

      <p className="mt-4 max-w-screen-md text-sm">
        Saving overwrites the existing certificate file, so any download link already sent to the student will resolve
        to the corrected version. The certificate number and issue date do not change, and the certificate is re-queued
        for the next daily state export.
      </p>

      <ValidatedForm
        id="admin-certificate-form"
        method="post"
        fetcher={fetcher}
        schema={hipHopDrivingCertificationSchema}
        defaultValues={defaultValues}
        className="mt-6"
      >
        {(form) => (
          <>
            <HiphopDrivingPreCertificateFields form={form} />
            <div className="mt-6 flex max-w-lg flex-col gap-4">
              <UncontrolledCheckbox
                name="sendEmail"
                value="true"
                label="Email the updated certificate to the student"
              />
              <SubmitButton variant="admin" isSubmitting={form.formState.isSubmitting} className="sm:w-auto">
                Save and Regenerate
              </SubmitButton>
            </div>
          </>
        )}
      </ValidatedForm>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
