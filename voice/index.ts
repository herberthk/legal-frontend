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
const INWORLD_API_KEY =
  "VFkzaGNoeldkOFg4MU5tMVM4a1YwU3YxYXdacXlZS0k6VTVMeEh6RTlJd05Mb1dpUHREY2gxQUhsR1RhTktJbklTQVlnY0Z3Tmxpd2FSZzBHUXpCNUVaM3dWOXhheE51Ng==";
async function main() {
  const url = "https://api.inworld.ai/tts/v1/voice";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${INWORLD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId: "Blake",
      modelId: "inworld-tts-1.5-mini",
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  const audioBuffer = Buffer.from(result.audioContent, "base64");
  fs.writeFileSync("output.mp3", audioBuffer);
  console.log("Audio saved to output.mp3");
}

// main();
// $env: NODE_TLS_REJECT_UNAUTHORIZED = 0;
