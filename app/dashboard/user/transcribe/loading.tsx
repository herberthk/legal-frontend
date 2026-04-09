import { TranscribeSkeleton } from "@/components/user/transcribe/TranscribeSkeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-indigo-50/5 dark:bg-slate-900">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
        <TranscribeSkeleton />
      </main>
    </div>
  );
}
