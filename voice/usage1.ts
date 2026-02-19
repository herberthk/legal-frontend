import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { spawn } from "bun";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { performance } from "node:perf_hooks";

import Inworld from "./inworld3";
import { COMMON_INSTRUCTIONS } from "./prompts";

type Metrics = {
  startTime: number;
  llmFirstTokenLatency: number;
  llmTotalTime: number;
  ttsFirstAudioLatency: number;
  totalTokens: number;
  totalAudioChunks: number;
};
// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const DEBUG = true;

const inworld = new Inworld({
  apiKey: process.env.INWORLD_API_KEY!,
  modelId: "inworld-tts-1.5-max",
  voiceId: "Luna",
  audioEncoding: "OGG_OPUS",
});

// ------------------------------------------------------------
// Gemini Streaming Generator (with instrumentation)
// ------------------------------------------------------------

async function* geminiStream(prompt: string, metrics: Metrics) {
  console.log("➡️ Starting Gemini request...");

  const startLLM = performance.now();

  const result = await streamText({
    model: google("gemini-2.5-flash-lite-preview-09-2025"),
    prompt,
    system: COMMON_INSTRUCTIONS,
  });

  console.log("✅ Gemini request created. Waiting for tokens...");

  let firstToken = true;
  let tokenCount = 0;

  for await (const delta of result.textStream) {
    console.log("🟢 Token:", delta);

    tokenCount++;

    if (firstToken) {
      metrics.llmFirstTokenLatency = performance.now() - startLLM;
      firstToken = false;
      console.log("⚡ First token received");
    }

    yield delta;
  }

  console.log("🏁 Gemini stream finished");

  metrics.totalTokens = tokenCount;
  metrics.llmTotalTime = performance.now() - startLLM;
}
// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
  const rl = readline.createInterface({ input, output });
  const connection = await inworld.connect();

  console.log("🎤 Voice Assistant Ready (type 'exit' to quit)");

  while (true) {
    const prompt = await rl.question("\nYou: ");
    if (prompt.toLowerCase() === "exit") break;

    const traceId = crypto.randomUUID().slice(0, 8);

    const metrics = {
      startTime: performance.now(),
      llmFirstTokenLatency: 0,
      llmTotalTime: 0,
      ttsFirstAudioLatency: 0,
      totalTokens: 0,
      totalAudioChunks: 0,
    };

    console.log(`\n🧠 [${traceId}] Thinking...\n`);

    const player = spawn(
      ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
      {
        stdin: "pipe",
        stdout: "ignore",
        stderr: "ignore",
      },
    );

    const audioStream = connection.synthesizeStreaming(
      geminiStream(prompt, metrics),
    );

    let firstAudio = true;
    const ttsStart = performance.now();

    for await (const chunk of audioStream) {
      if (firstAudio) {
        metrics.ttsFirstAudioLatency = performance.now() - ttsStart;
        firstAudio = false;
      }
      //   console.log("🟢 Audio chunk received", chunk.data.length);
      metrics.totalAudioChunks++;

      player.stdin?.write(chunk.data);
    }

    player.stdin?.end();

    metrics.llmTotalTime = performance.now() - metrics.startTime;

    // ------------------------------------------------------------
    // DEBUG OUTPUT
    // ------------------------------------------------------------

    if (DEBUG) {
      const tokensPerSec =
        metrics.totalTokens / (metrics.llmTotalTime / 1000 || 1);

      const audioChunksPerSec =
        metrics.totalAudioChunks / (metrics.llmTotalTime / 1000 || 1);

      console.log("\n📊 DEBUG METRICS");
      console.log("────────────────────────────────");
      console.log(`Trace ID:                ${traceId}`);
      console.log(
        `LLM First Token:         ${metrics.llmFirstTokenLatency.toFixed(1)} ms`,
      );
      console.log(
        `LLM Total Time:          ${metrics.llmTotalTime.toFixed(1)} ms`,
      );
      console.log(
        `TTS First Audio:         ${metrics.ttsFirstAudioLatency.toFixed(1)} ms`,
      );
      console.log(
        `Total Round Trip:        ${metrics.llmTotalTime.toFixed(1)} ms`,
      );
      console.log(`Total Tokens:            ${metrics.totalTokens}`);
      console.log(`Tokens/sec:              ${tokensPerSec.toFixed(2)}`);
      console.log(`Audio Chunks:            ${metrics.totalAudioChunks}`);
      console.log(`Audio Chunks/sec:        ${audioChunksPerSec.toFixed(2)}`);
      console.log("────────────────────────────────\n");
    }
  }

  await connection.close();
  rl.close();
}

main().catch(console.error);
