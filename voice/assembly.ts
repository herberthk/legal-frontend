// // Start by making sure the `assemblyai` and `node-record-lpcm16` packages are installed.
// // If not, you can install it by running the following command:
// // npm install assemblyai node-record-lpcm16

import { spawn } from "bun";

// import { AssemblyAI } from "assemblyai";
// import { Readable } from "stream";
// import recorder from "node-record-lpcm16";

// const run = async () => {
//   const client = new AssemblyAI({
//     // Replace with your chosen API key, this is the "default" account api key
//     apiKey: "5b2c6c9d1749406898dfd3b074a9cd28",
//   });

//   const CONNECTION_PARAMS = {
//     sampleRate: 16000,
//   };

//   const transcriber = client.streaming.transcriber(CONNECTION_PARAMS);

//   transcriber.on("open", ({ id }) => {
//     console.log(`Session opened with ID: ${id}`);
//   });

//   transcriber.on("error", (error) => {
//     console.error("Error:", error);
//   });

//   transcriber.on("close", (code, reason) =>
//     console.log("Session closed:", code, reason),
//   );

//   transcriber.on("turn", (turn) => {
//     if (!turn.transcript) {
//       return;
//     }

//     console.log("Turn:", turn.transcript);
//   });

//   try {
//     console.log("Connecting to streaming transcript service");

//     await transcriber.connect();

//     console.log("Starting recording");

//     const recording = recorder.record({
//       channels: 1,
//       sampleRate: CONNECTION_PARAMS.sampleRate,
//       audioType: "wav", // Linear PCM
//     });

//     Readable.toWeb(recording.stream()).pipeTo(transcriber.stream());

//     // Stop recording and close connection using Ctrl-C.
//     process.on("SIGINT", async function () {
//       console.log();
//       console.log("Stopping recording");
//       recording.stop();

//       console.log("Closing streaming transcript connection");
//       await transcriber.close();

//       process.exit();
//     });
//   } catch (error) {
//     console.error(error);
//   }
// };

// run();

const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY!;
const SAMPLE_RATE = 16000;

/**
 * Persistent AssemblyAI STT connection
 */
class AssemblySTT {
  private ws?: WebSocket;

  constructor(private onTranscript: (text: string) => void) {}

  connect() {
    this.ws = new WebSocket(
      "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000",
      {
        //@ts-ignore
        headers: {
          Authorization: process.env.ASSEMBLYAI_API_KEY!,
        },
      },
    );

    this.ws.onopen = () => {
      console.log("🎤 AssemblyAI connected");
      this.startMic();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.message_type === "FinalTranscript" && data.text) {
        console.log("🗣 You:", data.text);
        this.onTranscript(data.text);
      }
    };

    this.ws.onclose = () => {
      console.log("⚠️ STT disconnected. Reconnecting...");
      setTimeout(() => this.connect(), 1000);
    };
  }

  async startMic() {
    const mic = spawn([
      "ffmpeg",
      "-f",
      "dshow", // Windows
      "-i",
      'audio="Microphone (Realtek High Definition Audio)"', // CHANGE THIS
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "s16le",
      "-",
    ]);

    const reader = mic.stdout.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      this.ws?.send(value);
    }
    // mic.stdout.pipeTo(
    //   new WritableStream({
    //     write: (chunk) => this.ws?.send(chunk),
    //   }),
    // );
  }
}

export default AssemblySTT;

const stt = new AssemblySTT(async (text) => {
  console.log("🗣 You:", text);
});

stt.connect();
