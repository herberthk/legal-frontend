import fs from "fs";

export const text = `
Carol,

You walk into a room
and the air turns softer,
like the world remembered
how to breathe.

Your laugh is my favorite melody,
your smile my quiet sunrise.
In your eyes, I’ve found
both adventure and home.

If love had a name,
it would sound like yours.
`;
// Voice: Ashley, Blake, Sarah, Luna, Hana, Mark, Hades
// Model: inworld-tts-1.5-max, inworld-tts-1.5-mini
export const INWORLD_API_KEY =
  "VFkzaGNoeldkOFg4MU5tMVM4a1YwU3YxYXdacXlZS0k6VTVMeEh6RTlJd05Mb1dpUHREY2gxQUhsR1RhTktJbklTQVlnY0Z3Tmxpd2FSZzBHUXpCNUVaM3dWOXhheE51Ng==";
async function main() {
  const url = "https://api.inworld.ai/tts/v1/voice:stream";

  const audioConfig = {
    audio_encoding: "LINEAR16",
    sample_rate_hertz: 48000,
  };

  const startTime = Date.now();
  let ttfb = null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${INWORLD_API_KEY}`,
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
    body: JSON.stringify({
      text,
      voice_id: "Luna",
      model_id: "inworld-tts-1.5-max",
      audio_config: audioConfig,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const rawChunks = [];

  // Read the streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const chunk = JSON.parse(line);
          if (chunk.result && chunk.result.audioContent) {
            const audioBuffer = Buffer.from(
              chunk.result.audioContent,
              "base64",
            );
            if (ttfb === null) {
              ttfb = (Date.now() - startTime) / 1000;
            }
            // Skip WAV header (first 44 bytes) from each chunk
            if (audioBuffer.length > 44) {
              rawChunks.push(audioBuffer.subarray(44));
              console.log(`Received ${audioBuffer.length} bytes`);
            }
          }
        } catch {
          continue;
        }
      }
    }
  }

  // Build WAV file from raw audio data
  const rawAudio = Buffer.concat(rawChunks);
  const header = Buffer.alloc(44);
  const sampleRate = audioConfig.sample_rate_hertz;
  const byteRate = sampleRate * 2; // 16-bit mono

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + rawAudio.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(rawAudio.length, 40);

  fs.writeFileSync("output_stream.wav", Buffer.concat([header, rawAudio]));

  const totalTime = (Date.now() - startTime) / 1000;
  console.log("Audio saved to output_stream.wav");
  console.log(`Time to first chunk: ${ttfb?.toFixed(3)}s`);
  console.log(`Total time: ${totalTime.toFixed(3)}s`);
}

// main();
