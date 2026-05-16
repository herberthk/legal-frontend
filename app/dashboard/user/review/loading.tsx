export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-14 flex flex-col items-center pt-10 md:pt-20">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-4" />
        <div className="h-6 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-12" />
        <div className="w-full max-w-2xl h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      </div>
    </div>
  );
}
