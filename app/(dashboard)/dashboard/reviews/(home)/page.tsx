"use client";

import DirectionalTransition from "@/components/global/DirectionalTransition";
import { ReviewHistory } from "@/components/user/review/ReviewHistory";
import { useRouter } from "nextjs-toploader/app";
const ReviewsHistoryPage = () => {
  const router = useRouter();

  return (
    <DirectionalTransition>
      <ReviewHistory
        onNewReview={() => router.push("/dashboard/review")}
        onViewReview={(record: DocumentReview) => {
          router.push(`/dashboard/reviews/${record.id}`);
        }}
      />
    </DirectionalTransition>
  );
};

export default ReviewsHistoryPage;
