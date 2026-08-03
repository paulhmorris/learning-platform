import { Button } from "~/components/ui/button";

/**
 * Shown when the progress request failed. Progress is *unknown*, not zero — so this stands in
 * for anything that would otherwise tell the user they're locked out or incomplete.
 */
export function ProgressLoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-destructive bg-destructive/5 p-4">
      <p className="text-destructive">
        {message ?? "We couldn't load your progress, so we can't show where you left off."}
      </p>
      <Button
        variant="link"
        className="mt-1 h-auto p-0 text-base font-bold text-destructive underline decoration-2"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
