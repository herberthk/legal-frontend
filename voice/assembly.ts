// import { AssemblyAI } from "assemblyai";
// import { spawn } from "child_process";

// import { Readable } from "stream";

// const run = async () => {
//   const client = new AssemblyAI({
//     apiKey: process.env.ASSEMBLYAI_API_KEY!,
//   });

//   const CONNECTION_PARAMS = {
//     sampleRate: 16000,
//   };

//   const transcriber = client.streaming.transcriber(CONNECTION_PARAMS);

//   transcriber.on("open", ({ id }) => {
//     console.log(`Session opened with ID: ${id}`);
//   });

//   transcriber.on("error", (error) => {
//     console.error("AssemblyAI Error:", error);
//   });

//   transcriber.on("close", (code, reason) =>
//     console.log("Session closed:", code, reason),
//   );

//   transcriber.on("turn", (turn) => {
//     if (!turn.transcript) return;
//     console.log("Turn:", turn.transcript);
//   });

//   try {
//     console.log("Connecting to streaming transcript service...");
//     await transcriber.connect();
//     console.log("Starting recording via FFmpeg...");

//     // Spawn FFmpeg using the exact device name you found earlier
//     const ffmpeg = spawn("ffmpeg", [
//       "-f",
//       "dshow",
//       // Remove the literal quotes around the audio device name
//       "-i",
//       "audio=Microphone (Realtek High Definition Audio)",
//       "-ac",
//       "1",
//       "-ar",
//       "16000",
//       "-acodec",
//       "pcm_s16le",
//       "-f",
//       "s16le",
//       "pipe:1",
//     ]);

//     // Pipe FFmpeg's standard output straight into AssemblyAI's stream
//     Readable.toWeb(ffmpeg.stdout).pipeTo(transcriber.stream());

//     // Stop recording and close connection using Ctrl-C
//     process.on("SIGINT", async function () {
//       console.log("\nStopping recording...");
//       ffmpeg.kill("SIGINT"); // Kill the FFmpeg process
//       console.log("Closing streaming transcript connection...");
//       await transcriber.close();
//       process.exit();
//     });

//     ffmpeg.stderr.on("data", (data) => {
//       // Optional: FFmpeg outputs its logs to stderr.
//       // Uncomment the line below if you want to see FFmpeg's internal logging for debugging.
//       // console.log(`FFmpeg log: ${data}`);
//     });
//   } catch (error) {
//     console.error(error);
//   }
// };

// run();
