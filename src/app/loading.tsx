export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse space-y-3 w-full max-w-sm px-4">
        <div className="h-8 bg-muted rounded-xl" />
        <div className="h-4 bg-muted rounded-xl w-3/4" />
        <div className="h-4 bg-muted rounded-xl w-1/2" />
      </div>
    </div>
  );
}
