export function SectionProgressHeader() {
  return (
    <div className="hidden grid-cols-12 items-center justify-between text-left text-muted-foreground md:grid">
      <p className="col-span-1 text-sm">Status</p>
      <p className="col-span-2 text-sm">Title</p>
      <p className="col-span-3 text-sm">Progress</p>
      <p className="col-span-6 text-sm">Actions</p>
    </div>
  );
}
