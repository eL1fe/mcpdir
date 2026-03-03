"use client";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-cyan/20 border border-cyan/30 px-6 py-2 text-sm font-medium text-cyan hover:bg-cyan/30 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
