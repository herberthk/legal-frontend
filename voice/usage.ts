import { createInterface } from "node:readline";
import { AudioChunk, Inworld, InworldConnection } from "./inworld2";
import { INWORLD_API_KEY } from "./stream";
// Load your API key from environment or config
if (!INWORLD_API_KEY) {
  console.error("Please set INWORLD_API_KEY environment variable");
  process.exit(1);
}

const inworld = new Inworld({
  apiKey: INWORLD_API_KEY,
  modelId: "inworld-tts-1.5-mini",
  voiceId: "Hana",
  autoSplitSentences: true,
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Speaks text and returns a Promise that resolves with latency metrics.
 * Metrics: ttfa (time to first audio), totalTime.
 */
function speakWithMetrics(
  connection: InworldConnection,
  text: string,
): Promise<{ ttfa: number; totalTime: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let ttfa: number | null = null;

    const onAudio = (chunk: Uint8Array) => {
      if (ttfa === null) {
        ttfa = Date.now() - start;
      }
      console.log("Audio chunk received", chunk.length);
    };

    const onDone = () => {
      const totalTime = Date.now() - start;
      // Clean up listeners
      connection.off("audio", onAudio);
      connection.off("error", onError);
      resolve({ ttfa: ttfa ?? totalTime, totalTime }); // fallback if no audio? shouldn't happen
    };

    const onError = (err: Error) => {
      connection.off("audio", onAudio);
      connection.off("done", onDone);
      reject(err);
    };

    connection.on("audio", onAudio);
    connection.once("done", onDone);
    connection.once("error", onError);

    connection.speak(text);
  });
}

async function main() {
  const connection = await inworld.connect();
  console.log(
    "✅ Connected to Inworld TTS. Type text and press Enter (Ctrl+C to exit):\n",
  );

  process.on("SIGINT", async () => {
    console.log("\n👋 Closing connection...");
    await connection.close();
    process.exit(0);
  });

  while (true) {
    const line = await new Promise<string>((resolve) => {
      rl.question("🗣️  > ", resolve);
    });

    if (line.trim() === "") continue;

    try {
      const { ttfa, totalTime } = await speakWithMetrics(connection, line);
      console.log(`✅ Done. TTFA: ${ttfa} ms | Total: ${totalTime} ms\n`);
    } catch (err) {
      console.error("❌ Error during synthesis:", err);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
