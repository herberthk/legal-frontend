import { AssemblyAI } from "assemblyai";
import { spawn as child_process_spawn } from "child_process";
import { Readable } from "stream";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { Inworld } from "./inworld";
import { LEGAL_SYSTEM_INSTRUCTION } from "./prompts";
import { spawn } from "bun";

import { config } from "dotenv";

config(); // load .env

if (!process.env.INWORLD_API_KEY) {
  console.error("❌ INWORLD_API_KEY is not defined");
  process.exit(1);
}

if (!process.env.ASSEMBLYAI_API_KEY) {
  console.error("❌ ASSEMBLYAI_API_KEY is not defined");
  process.exit(1);
}

async function main() {
  // 1️⃣ Inworld TTS
  const inworld = new Inworld({
    apiKey: process.env.INWORLD_API_KEY!,
    voiceId: "Blake",
    modelId: "inworld-tts-1.5-mini",
    encoding: "LINEAR16",
    sampleRate: 24000,
  });

  const player = spawn(
    ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
    {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "ignore",
    },
  );

  await inworld.connect();

  // Per-turn metrics (live across the closure)
  const metrics = {
    startTime: 0,
    llmFirstTokenLatency: 0,
    llmTotalTime: 0,
    ttsFirstAudioLatency: 0,
    totalTokens: 0,
    totalAudioChunks: 0,
  };
  let ttsTimerStart = 0;
  let ttsFirstAudioReceived = false;

  inworld.onAudio((chunk) => {
    if (!ttsFirstAudioReceived && ttsTimerStart > 0) {
      metrics.ttsFirstAudioLatency = performance.now() - ttsTimerStart;
      ttsFirstAudioReceived = true;
      console.log(
        "🔊 TTS First Audio:",
        metrics.ttsFirstAudioLatency.toFixed(2),
        "ms",
      );
    }
    metrics.totalAudioChunks++;
    player.stdin.write(chunk);
  });

  // 2️⃣ Gemini Stream
  //   async function* geminiStream(prompt: string) {
  //     console.log("➡️ Starting Gemini request...");
  //     const result = await streamText({
  //       model: google("gemini-2.0-flash"),
  //       prompt,
  //       system: LEGAL_SYSTEM_INSTRUCTION({
  //         user: "Herbert",
  //         instructor: "Kelly",
  //       }),
  //     });

  //     for await (const delta of result.textStream) {
  //       yield delta;
  //     }
  //   }

  // 3️⃣ AssemblyAI Client
  const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!,
  });

  const transcriber = client.streaming.transcriber({
    sampleRate: 16000,
  });

  transcriber.on("open", ({ id }) => {
    console.log(`🎤 STT Session opened: ${id}`);
  });

  transcriber.on("error", (err) => {
    console.error("AssemblyAI Error:", err);
  });

  transcriber.on("close", () => {
    console.log("STT Session closed");
  });

  // 🔥 THIS replaces readline — STT → Gemini → Inworld TTS
  transcriber.on("turn", async (turn) => {
    if (!turn.transcript) return;

    // Only act when user finishes speaking
    if (!turn.end_of_turn) return;

    console.log("🗣 You:", turn.transcript);

    // Reset metrics for this turn
    metrics.startTime = performance.now();
    metrics.llmFirstTokenLatency = 0;
    metrics.llmTotalTime = 0;
    metrics.ttsFirstAudioLatency = 0;
    metrics.totalTokens = 0;
    metrics.totalAudioChunks = 0;
    ttsTimerStart = 0;
    ttsFirstAudioReceived = false;

    try {
      console.log("➡️ Sending to Gemini...");
      const startLLM = performance.now();
      let firstToken = true;

      const result = await streamText({
        model: google("gemini-2.0-flash"),
        prompt: turn.transcript,
        system: LEGAL_SYSTEM_INSTRUCTION({
          user: "Herbert",
          instructor: "Kelly",
        }),
      });

      process.stdout.write("🤖 Assistant: ");
      for await (const delta of result.textStream) {
        process.stdout.write(delta);
        metrics.totalTokens++;

        if (firstToken) {
          metrics.llmFirstTokenLatency = performance.now() - startLLM;
          // TTS timer starts when first token is pushed to Inworld
          ttsTimerStart = performance.now();
          firstToken = false;
        }

        inworld.push(delta);
      }
      process.stdout.write("\n");

      metrics.llmTotalTime = performance.now() - startLLM;

      // Flush any remaining partial sentence to Inworld
      await inworld.flush();

      // Wait a tick for TTS first-audio callback to fire before printing
      await new Promise((r) => setTimeout(r, 200));

      console.log("\n📊 Latency Metrics:");
      console.log(
        "  ⚡ LLM First Token:  ",
        metrics.llmFirstTokenLatency.toFixed(2),
        "ms",
      );
      console.log(
        "  ⏱️  LLM Total Time:   ",
        metrics.llmTotalTime.toFixed(2),
        "ms",
      );
      console.log(
        "  🔊 TTS First Audio:  ",
        metrics.ttsFirstAudioLatency > 0
          ? metrics.ttsFirstAudioLatency.toFixed(2) + " ms"
          : "pending...",
      );
      console.log("  🔤 Total Tokens:     ", metrics.totalTokens);
      console.log("  🎵 Audio Chunks:     ", metrics.totalAudioChunks);
      console.log("─────────────────────────────────────\n");
    } catch (err) {
      console.error("❌ Error in turn handler:", err);
    }
  });

  console.log("Connecting to AssemblyAI...");
  await transcriber.connect();

  console.log("Starting microphone...");

  const ffmpeg = child_process_spawn("ffmpeg", [
    "-f",
    "dshow",
    "-i",
    "audio=Microphone (Realtek High Definition Audio)", // your device
    "-ac",
    "1",
    "-ar",
    "16000",
    "-acodec",
    "pcm_s16le",
    "-f",
    "s16le",
    "pipe:1",
  ]);

  Readable.toWeb(ffmpeg.stdout).pipeTo(transcriber.stream());

  process.on("SIGINT", async () => {
    console.log("\nStopping...");
    ffmpeg.kill("SIGINT");
    await transcriber.close();
    inworld.destroy();
    process.exit();
  });
}

main();
