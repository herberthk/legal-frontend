import {
  ArrowLeft,
  Mic,
  Clock,
  Calendar,
  Share2,
  MoreVertical,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { formatCost } from "@/utils";
import { getVoiceSessionById } from "@/lib/actions/voice";
import Link from "next/link";
import SessionDetailClient from "@/components/user/SessionDetailClient";
import ClientFormattedDate from "@/components/global/ClientFormattedDate";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Transcription Detail",
  description: "Transcription detail of voice consultation",
};

const SessionDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  const session = await getVoiceSessionById(id);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
          <Mic size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Session Not Found
        </h2>
        <p className="text-slate-500">
          The session you are looking for does not exist or has been removed.
        </p>
        <Link href="/dashboard/transcription">
          <Button variant="outline">Go Back to Archive</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/transcripts">
          <Button
            variant="ghost"
            className="group flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-4 py-2"
          >
            <ArrowLeft
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
            <span className="font-bold">Back to Archive</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-slate-700"
          >
            <Share2 size={18} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-600"
          >
            <MoreVertical size={18} />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-4 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Mic size={240} />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider w-fit">
              <Mic size={12} />
              Confirmed Session
            </div>
            <h1 className="md:text-2xl text-lg font-black text-slate-900 dark:text-white leading-tight tracking-tight">
              {session.title}
            </h1>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar size={16} />
                <ClientFormattedDate
                  date={session.createdAt}
                  className="text-sm font-medium"
                />
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Clock size={16} />
                <span className="text-sm font-medium" suppressHydrationWarning>
                  {formatTime(session.duration)}
                </span>
              </div>
              <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-xs font-bold ring-1 ring-green-600/10">
                Saved to Cloud
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between gap-8 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Session ID
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {session.id}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CircleDollarSign size={14} />
                    <span>Estimated Cost</span>
                  </div>
                  <span className="md:text-sm text-xs font-bold ml-1">
                    {formatCost(session.cost || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <SessionDetailClient session={session} />
    </div>
  );
};

export default SessionDetailPage;
