import { createInterface } from "node:readline";
import { Inworld } from "./inworld2";
import { google } from "@ai-sdk/google"; // Google provider
import { streamText } from "ai";
import { config } from "dotenv";

config(); // load .env

const INWORLD_API_KEY = process.env.INWORLD_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY; // Gemini expects this env var

if (!INWORLD_API_KEY || !GOOGLE_API_KEY) {
  console.error(
    "Missing required API keys. Please set INWORLD_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY.",
  );
  process.exit(1);
}

const inworld = new Inworld({
  apiKey: INWORLD_API_KEY,
  modelId: "inworld-tts-1.5-mini",
  voiceId: "Hana",
  autoSplitSentences: false, // we handle sentence splitting ourselves
});

const rl = createInterface({ input: process.stdin, output: process.stdout });

/**
 * Creates an async generator that yields text chunks from the Google Gemini stream,
 * grouped into sentences for better TTS prosody.
 */
async function* createLLMTextStream(prompt: string): AsyncGenerator<string> {
  // Use Google Gemini (you can change the model, e.g., "gemini-1.5-flash")
  const result = streamText({
    model: google("gemini-2.5-flash-lite-preview-09-2025"), // or "gemini-1.5-pro"
    prompt,
  });

  let buffer = "";
  for await (const token of result.textStream) {
    process.stdout.write(token); // show tokens as they arrive
    buffer += token;

    // When a sentence boundary is detected, yield the complete sentence
    if (/[.!?。！？।؟۔]$/.test(buffer)) {
      yield buffer;
      buffer = "";
    }
  }
  if (buffer) yield buffer; // final fragment
}

async function main() {
  console.log("Connecting to Inworld TTS...");
  const connection = await inworld.connect();
  console.log(
    "✅ Connected. Type your prompt and press Enter (Ctrl+C to exit):\n",
  );

  process.on("SIGINT", async () => {
    console.log("\n👋 Closing connection...");
    await connection.close();
    process.exit(0);
  });

  while (true) {
    const prompt = await new Promise<string>((resolve) => {
      rl.question("🤖 > ", resolve);
    });
    if (!prompt.trim()) continue;

    console.log("\n--- LLM Response ---");

    const start = Date.now();
    let firstAudio = true;

    try {
      for await (const chunk of connection.synthesizeStreaming(
        createLLMTextStream(prompt),
      )) {
        if (firstAudio) {
          console.log(`\n⏱️  Time to first audio: ${Date.now() - start} ms`);
          firstAudio = false;
        }
        // Here you would play the audio chunk (e.g., via speaker)
        console.log(`🎵 Audio chunk received: ${chunk.data.length} bytes`);
      }
      console.log(
        `✅ Synthesis finished. Total time: ${Date.now() - start} ms\n`,
      );
    } catch (err) {
      console.error("❌ Error during synthesis:", err);
    }
  }
}

main().catch(console.error);
