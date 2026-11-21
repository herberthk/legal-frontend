import { describe, expect, it } from "vitest";

import {
  buildVoiceAuthTokenConfig,
  buildVoiceLiveConfig,
  GEMINI_LIVE_API_VERSION,
  GEMINI_LIVE_MODEL,
  voiceTokenContract,
} from "@/lib/voice/live-config";

describe("Gemini Live voice contract", () => {
  it("builds one constrained Gemini 3.8/v1beta configuration", () => {
    const { config, credits } = buildVoiceLiveConfig({
      userName: "Ada Lovelace",
      preferedVoice: {
        preferedVoiceId: "Kore",
        preferedVoiceName: "Ashley",
      },
      freeVoiceSeconds: 120,
      balance: 100,
    });
    const auth = buildVoiceAuthTokenConfig(config, 1_000);
    const response = voiceTokenContract("ephemeral", config, credits);

    expect(response).toMatchObject({
      token: "ephemeral",
      model: GEMINI_LIVE_MODEL,
      apiVersion: GEMINI_LIVE_API_VERSION,
    });
    expect(config).toMatchObject({
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: {},
    });
    expect(JSON.stringify(config.systemInstruction)).toContain("You are Ashley");
    expect(auth).toMatchObject({
      uses: 1,
      httpOptions: { apiVersion: "v1beta" },
      liveConnectConstraints: { model: "gemini-3.8-live" },
    });
    expect(auth.liveConnectConstraints?.config).not.toHaveProperty("sessionResumption");
    expect(auth.liveConnectConstraints?.config?.systemInstruction).toEqual(config.systemInstruction);
    expect(auth.lockAdditionalFields).toEqual(["systemInstruction"]);
    expect(JSON.stringify(response)).not.toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("caps server-advertised call capacity at thirty minutes", () => {
    const { credits } = buildVoiceLiveConfig({
      userName: "Ada",
      freeVoiceSeconds: 120,
      balance: 10_000,
    });
    expect(credits.allowedSeconds).toBe(1_800);
  });
  it.each([
    [0, 0, 300, 0],
    [10, 1, 300, 17],
    [10, 1, 12.9, 12],
    [10, 1, NaN, 17],
  ])("caps credits (%s free seconds, %s cents) at %s", (freeVoiceSeconds, balance, maxSecs, allowedSeconds) => {
    const { credits } = buildVoiceLiveConfig({
      userName: "Ada",
      freeVoiceSeconds,
      balance,
      maxSecs,
    });
    expect(credits).toEqual({ freeVoiceSeconds, balance, allowedSeconds });
  });
});
