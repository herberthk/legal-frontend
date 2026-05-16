"use client";

import { ReviewHistory } from "@/components/user/review/ReviewHistory";
import { useRouter } from "nextjs-toploader/app";
const ReviewsHistoryPage = () => {
  const router = useRouter();

  return (
    <ReviewHistory
      onNewReview={() => router.push("/dashboard/user/review")}
      onViewReview={(record: DocumentReview) => {
        router.push(`/dashboard/user/reviews/${record.id}`);
      }}
    />
  );
};

export default ReviewsHistoryPage;
