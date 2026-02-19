import { spawn } from "bun";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { Inworld } from "./inworld4";
import { LEGAL_SYSTEM_INSTRUCTION } from "./prompts";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Metrics = {
  startTime: number;
  llmFirstTokenLatency: number;
  llmTotalTime: number;
  ttsFirstAudioLatency: number;
  totalTokens: number;
  totalAudioChunks: number;
};

const inworld = new Inworld({
  apiKey: process.env.INWORLD_API_KEY!,
  voiceId: "Blake",
  modelId: "inworld-tts-1.5-mini",
});

await inworld.connect();

const player = spawn(
  ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
  {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "ignore",
  },
);

console.log("🎤 Voice Assistant Ready (type 'exit' to quit)");

const rl = readline.createInterface({ input, output });

while (true) {
  const userInput = await rl.question("You: ");
  if (userInput.toLowerCase() === "exit") break;

  const metrics: Metrics = {
    startTime: performance.now(),
    llmFirstTokenLatency: 0,
    llmTotalTime: 0,
    ttsFirstAudioLatency: 0,
    totalTokens: 0,
    totalAudioChunks: 0,
  };

  let firstAudio = true;
  let ttsStart = 0;

  // Register audio listener ONCE per request
  inworld.onAudio((chunk) => {
    if (firstAudio) {
      metrics.ttsFirstAudioLatency = performance.now() - ttsStart;
      firstAudio = false;
      console.log(
        "🔊 TTS First Audio:",
        metrics.ttsFirstAudioLatency.toFixed(2),
        "ms",
      );
    }
    // console.log("recieved audio chunk", chunk.length);
    metrics.totalAudioChunks++;
    player.stdin.write(chunk);
  });

  console.log("➡️ Starting Gemini request...");

  const startLLM = performance.now();

  const result = await streamText({
    model: google("gemini-2.0-flash"),
    prompt: userInput,
    system: LEGAL_SYSTEM_INSTRUCTION({
      user: "Herbert",
      instructor: "Kelly",
    }),
  });

  let firstToken = true;

  // Start streaming
  for await (const delta of result.textStream) {
    process.stdout.write(delta);

    metrics.totalTokens++;

    if (firstToken) {
      metrics.llmFirstTokenLatency = performance.now() - startLLM;
      // TTS timer starts when first token is pushed
      ttsStart = performance.now();
      firstToken = false;
    }

    inworld.push(delta);
  }

  metrics.llmTotalTime = performance.now() - startLLM;

  //   await inworld.flush();
  //   await inworld.close();

  console.log("\n📊 Metrics:");
  console.log(
    "LLM First Token:",
    metrics.llmFirstTokenLatency.toFixed(2),
    "ms",
  );
  console.log("LLM Total Time:", metrics.llmTotalTime.toFixed(2), "ms");
  console.log(
    "TTS First Audio:",
    metrics.ttsFirstAudioLatency.toFixed(2),
    "ms",
  );
  console.log("Total Tokens:", metrics.totalTokens);
  console.log("Audio Chunks:", metrics.totalAudioChunks);
  console.log("--------------------------------------------------\n");
}

rl.close();
player.stdin.end();
inworld.destroy();
