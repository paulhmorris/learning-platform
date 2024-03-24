export function QuizFailed({ score }: { score: number }) {
  return (
    <div className="mb-8">
      <div className="rounded-md border-destructive bg-destructive/5 p-4 text-destructive dark:bg-destructive/15">
        <h2 className="text-2xl font-bold">You didn&apos;t pass.</h2>
        <p>You failed with a score of {score}%. Please try again.</p>
      </div>
    </div>
  );
}
