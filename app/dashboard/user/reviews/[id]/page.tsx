import { ReviewDetailView } from "@/components/user/review/ReviewDetailView";
import { getDocumentReview } from "@/lib/actions/review";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ReviewHistoryDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  const { success, review } = await getDocumentReview(id);

  if (!success || !review) {
    notFound();
  }

  return <ReviewDetailView review={review} />;
};

export default ReviewHistoryDetailPage;
