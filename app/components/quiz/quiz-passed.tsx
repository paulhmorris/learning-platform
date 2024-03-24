export function QuizPassed({ score }: { score: number }) {
  return (
    <div className="mb-8">
      <div className="rounded-md border-success bg-success/5 p-4 text-success dark:bg-success/15">
        <h2 className="text-2xl font-bold">You passed!</h2>
        <p>You passed with a score of {score}%. Great job!</p>
      </div>
    </div>
  );
}
