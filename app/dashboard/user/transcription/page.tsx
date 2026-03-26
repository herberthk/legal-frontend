import { Mic } from "lucide-react";
import VoiceConsultations from "@/components/user/VoiceConsultations";
import { Button } from "@/components/ui/button";
import { getVoiceSessions } from "@/lib/actions/voice";
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import TranscriptionFilters from "@/components/user/TranscriptionFilters";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    filter?: UsageFilter;
    search?: string;
  }>;
}

const TranscriptionPage = async ({ searchParams }: PageProps) => {
  const { page = "1", filter = "last_week", search = "" } = await searchParams;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl">
        <h2 className="text-xl font-bold">
          Please sign in to view your archive.
        </h2>
      </div>
    );
  }

  const { sessions, totalCount } = await getVoiceSessions({
    userId,
    page: parseInt(page),
    limit: 8,
    filter,
    searchQuery: search,
  });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <TranscriptionFilters initialFilter={filter} initialSearch={search} />

      {/* Sessions List */}
      <div className="space-y-6">
        <VoiceConsultations
          isDashboard={false}
          sessions={sessions}
          totalSessionsCount={totalCount}
        />
      </div>

      {/* Help Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-linear-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-8 rounded-3xl text-white overflow-hidden relative group">
        <div className="relative z-10 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Mic className="w-6 h-6 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold">Need a specific session?</h2>
          <p className="text-slate-400 max-w-md">
            All your voice consultations are automatically recorded and
            summarized by our AI. If you can&apos;t find a session, try
            searching by keywords or legal topics discussed.
          </p>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white border-none rounded-xl h-11 px-6">
            Contact Support
          </Button>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none translate-x-1/4 translate-y-1/4">
          <Mic size={300} />
        </div>
      </div>
    </div>
  );
};

export default TranscriptionPage;
