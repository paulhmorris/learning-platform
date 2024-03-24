import { IconLock } from "@tabler/icons-react";

import { PageTitle } from "~/components/common/page-title";

export function QuizLocked({ title }: { title: string }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <div className="mt-8 space-y-8">
        <IconLock className="size-12" />
        <div>
          <h2 className="mb-1 text-2xl">This quiz is locked.</h2>
          <p>Please navigate to an available lesson or quiz in the course overview.</p>
        </div>
      </div>
    </>
  );
}
