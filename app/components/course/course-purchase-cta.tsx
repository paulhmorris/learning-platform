import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export function CoursePurchaseCTA() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-x-12 gap-y-6 sm:flex-row sm:items-center">
        <div className="flex flex-col justify-between gap-1">
          <h3 className="text-pretty text-2xl">Enroll in this course to begin.</h3>
        </div>
        <Button className="sm:ml-auto sm:max-w-60" variant="primary" asChild>
          <Link to={`/purchase`}>Enroll</Link>
        </Button>
      </div>
    </div>
  );
}
