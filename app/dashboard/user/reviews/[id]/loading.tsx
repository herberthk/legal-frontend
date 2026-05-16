"use client";

import { ReviewSkeleton } from "@/components/user/review/ReviewSkeleton";
import { useRouter } from "nextjs-toploader/app";

const Loading = () => {
  const router = useRouter();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/user/reviews")}
          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline mb-4 inline-flex items-center gap-2"
        >
          &larr; Back to History
        </button>
      </div>
      <ReviewSkeleton />
    </div>
  );
};

export default Loading;
