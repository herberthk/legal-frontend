import { ReviewSkeleton } from "@/components/user/review/ReviewSkeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-14">
        <ReviewSkeleton />
      </div>
    </div>
  );
}
