"use client";

import React from "react";
import { Mic, FileText, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TranscriptionPage = () => {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Voice Transcription
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Convert your legal consultations and voice notes into text instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle>Record Audio</CardTitle>
            <CardDescription>Start a new recording to transcribe in real-time.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white border-none">
              Start Recording
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Upload an existing audio file for transcription.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700">
              Upload Audio
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
              <History className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle>Recent Transcriptions</CardTitle>
            <CardDescription>View and manage your previous transcription history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="w-full text-slate-600 dark:text-slate-400">
              View History
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle>Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
          <p>• Ensure you are in a quiet environment for better recording quality.</p>
          <p>• Supported file formats for upload: MP3, WAV, M4A (max 25MB).</p>
          <p>• Legal terminology is supported for more accurate results.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TranscriptionPage;
