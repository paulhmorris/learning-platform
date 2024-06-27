export function QuizProgressHeader() {
  return (
    <>
      <h2 className="mb-2 text-xl">Quizzes</h2>
      <div className="grid grid-cols-12 items-center justify-between text-left text-muted-foreground">
        <p className="col-span-1 text-sm">Status</p>
        <p className="col-span-2 text-sm">Title</p>
        <p className="col-span-3 text-sm">Score / Passing Score</p>
        <p className="col-span-6 text-sm">Actions</p>
      </div>
    </>
  );
}
