import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface WorkletInstance {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: { data: unknown }) => void) | null;
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

function loadWorklet(filename: string, sampleRate: number) {
  const filePath = path.resolve(process.cwd(), "public/js", filename);
  const code = fs.readFileSync(filePath, "utf8");
  let RegisteredCtor: (new () => WorkletInstance) | null = null;

  class AudioWorkletProcessor {
    port = {
      postMessage: vi.fn(),
      onmessage: null as ((event: { data: unknown }) => void) | null,
    };
  }

  const context = vm.createContext({
    sampleRate,
    AudioWorkletProcessor,
    registerProcessor: (_name: string, ctor: new () => WorkletInstance) => {
      RegisteredCtor = ctor;
    },
    Float32Array,
    Int16Array,
    Math,
  });

  vm.runInContext(code, context);
  if (!RegisteredCtor) {
    throw new Error(`Worklet ${filename} did not call registerProcessor`);
  }
  return new (RegisteredCtor as new () => WorkletInstance)();
}

describe("PCMPlayerProcessor AudioWorklet", () => {
  it("resamples 24 kHz PCM to 48 kHz with linear interpolation and debounces bufferEmpty (~250ms)", () => {
    const player = loadWorklet("pcm-player-processor.js", 48000);

    // Enqueue 4 samples at 24 kHz -> should render 8 samples at 48 kHz
    const pcm = new Int16Array([0, 16384, 32767, 16384]);
    player.port.onmessage?.({ data: pcm.buffer });

    const left = new Float32Array(128);
    const right = new Float32Array(128);
    player.process([], [[left, right]], {});

    // At 48 kHz (rateRatio = 0.5), output linearly interpolates midpoints:
    // frame 0: s0=0.0, frame 1: midpoint(0, 0.5)=0.25, frame 2: 0.5, frame 3: ~0.75
    expect(left[0]).toBeCloseTo(0, 4);
    expect(left[1]).toBeCloseTo(0.25, 3);
    expect(left[2]).toBeCloseTo(0.5, 3);
    expect(left[3]).toBeCloseTo(0.75, 2);
    expect(right[1]).toBeCloseTo(left[1], 5);
    expect(left[10]).toBe(0);

    // Feed a second block so wasActive becomes true on a non-empty block,
    // then verify bufferEmpty does not fire early and fires after ~250ms of silence.
    const pcmLong = new Int16Array(200).fill(8192);
    player.port.onmessage?.({ data: pcmLong.buffer });
    player.process([], [[new Float32Array(128)]], {});
    expect(player.port.postMessage).not.toHaveBeenCalled();

    // Drain remaining ~272 output samples + 250ms debounce (~94 empty blocks at 48 kHz)
    for (let i = 0; i < 110; i++) {
      player.process([], [[new Float32Array(128)]], {});
    }
    expect(player.port.postMessage).toHaveBeenCalledTimes(1);
    expect(player.port.postMessage).toHaveBeenCalledWith({
      type: "bufferEmpty",
    });
  });
});

describe("PCMProcessor AudioWorklet", () => {
  it("ducks speaker echo with adaptive floor and latches/unlatches natural multi-syllable barge-in", () => {
    const mic = loadWorklet("pcm-processor.js", 48000);

    // Turn on AI speaking (half-duplex ducking active)
    mic.port.onmessage?.({ data: { command: "aiSpeaking", value: true } });

    const blockOf = (amp: number) => new Float32Array(128).fill(amp);

    // 1. Moderate speaker echo (0.10 RMS < 0.12 base threshold) must be zeroed and train adaptive floor
    for (let i = 0; i < 80; i++) {
      mic.process([[blockOf(0.1)]], [], {});
    }
    expect(mic.port.postMessage).toHaveBeenCalled();
    const duckedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      isSpeaking: boolean;
      bargedIn: boolean;
    };
    const duckedSamples = new Int16Array(duckedMsg.pcm);
    expect(duckedSamples.length).toBe(640);
    expect(duckedSamples.every((v) => v === 0)).toBe(true);
    expect(duckedMsg.isSpeaking).toBe(false);
    expect(duckedMsg.bargedIn).toBe(false);

    // 2. Speaker syllable peak (0.15 RMS) stays below adaptive floor (~0.095 * 1.65 ≈ 0.157) -> stays ducked
    for (let i = 0; i < 50; i++) {
      mic.process([[blockOf(0.15)]], [], {});
    }
    const adaptedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      isSpeaking: boolean;
      bargedIn: boolean;
    };
    expect(new Int16Array(adaptedMsg.pcm).every((v) => v === 0)).toBe(true);
    expect(adaptedMsg.bargedIn).toBe(false);

    // 3. Brief loud click/plosive (0.35 RMS for ~27ms < 110ms attack) must NOT trigger barge-in
    for (let i = 0; i < 10; i++) {
      mic.process([[blockOf(0.35)]], [], {});
    }
    for (let i = 0; i < 20; i++) {
      mic.process([[blockOf(0.05)]], [], {});
    }
    const postSpikeMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      isSpeaking: boolean;
      bargedIn: boolean;
    };
    expect(new Int16Array(postSpikeMsg.pcm).every((v) => v === 0)).toBe(true);
    expect(postSpikeMsg.bargedIn).toBe(false);

    // 4. Natural multi-syllable user correction (0.26 RMS with brief consonant dips to 0.06 every 15 blocks)
    // Leaky integrator accumulates across dips and latches barge-in cleanly
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let i = 0; i < 15; i++) {
        mic.process([[blockOf(0.26)]], [], {});
      }
      for (let i = 0; i < 2; i++) {
        mic.process([[blockOf(0.06)]], [], {});
      }
    }
    const bargedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      isSpeaking: boolean;
      bargedIn: boolean;
    };
    const bargedSamples = new Int16Array(bargedMsg.pcm);
    expect(bargedSamples.some((v) => v > 1000)).toBe(true);
    expect(bargedMsg.isSpeaking).toBe(true);
    expect(bargedMsg.bargedIn).toBe(true);

    // 5. Residual speaker bleed (0.02 RMS < 0.035 release floor) for >300ms (~113 blocks + 1 full chunk) unlatches barge-in
    for (let i = 0; i < 140; i++) {
      mic.process([[blockOf(0.02)]], [], {});
    }
    const unlatchedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      isSpeaking: boolean;
      bargedIn: boolean;
    };
    expect(new Int16Array(unlatchedMsg.pcm).every((v) => v === 0)).toBe(true);
    expect(unlatchedMsg.isSpeaking).toBe(false);
    expect(unlatchedMsg.bargedIn).toBe(false);

    // 6. After release, a 30-block spike (~80ms < 110ms attack) must NOT re-latch.
    // It would re-latch if the previous attack count had not been reset.
    for (let i = 0; i < 30; i++) {
      mic.process([[blockOf(0.35)]], [], {});
    }
    for (let i = 0; i < 20; i++) {
      mic.process([[blockOf(0.02)]], [], {});
    }
    const postReleaseSpikeMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      bargedIn: boolean;
    };
    expect(postReleaseSpikeMsg.bargedIn).toBe(false);
    expect(new Int16Array(postReleaseSpikeMsg.pcm).every((v) => v === 0)).toBe(true);

    // 7. A sustained second interruption (>= 110ms + 1 full output chunk) still re-latches cleanly
    for (let i = 0; i < 60; i++) {
      mic.process([[blockOf(0.3)]], [], {});
    }
    const secondBargeMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      bargedIn: boolean;
    };
    expect(secondBargeMsg.bargedIn).toBe(true);
    expect(new Int16Array(secondBargeMsg.pcm).some((v) => v > 1000)).toBe(true);
  });

  it("clears a latched barge-in when a new AI speaking turn starts during hangover", () => {
    const mic = loadWorklet("pcm-processor.js", 48000);
    const blockOf = (amp: number) => new Float32Array(128).fill(amp);

    // Headphones scenario (zero echo floor): conversational 0.16 RMS > 0.12 for >110ms latches barge-in
    mic.port.onmessage?.({ data: { command: "aiSpeaking", value: true } });
    for (let i = 0; i < 55; i++) {
      mic.process([[blockOf(0.16)]], [], {});
    }
    expect(
      (mic.port.postMessage.mock.calls.at(-1)?.[0] as { bargedIn: boolean })
        .bargedIn,
    ).toBe(true);

    // Turn 1 interrupted -> aiSpeaking false, then Turn 2 starts within 450ms hangover
    mic.port.onmessage?.({ data: { command: "aiSpeaking", value: false } });
    for (let i = 0; i < 10; i++) {
      mic.process([[blockOf(0.08)]], [], {});
    }
    mic.port.onmessage?.({ data: { command: "aiSpeaking", value: true } });
    // Feed 30 blocks (2 full 15-block chunks) so the latest emitted chunk is
    // completely inside the new AI turn (no overlap with hangover blocks).
    for (let i = 0; i < 30; i++) {
      mic.process([[blockOf(0.08)]], [], {});
    }

    const nextTurnMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      bargedIn: boolean;
    };
    expect(nextTurnMsg.bargedIn).toBe(false);
    expect(new Int16Array(nextTurnMsg.pcm).every((v) => v === 0)).toBe(true);
  });

  it("tracks adaptive echo floor and latches multi-syllable barge-in consistently at 24 kHz", () => {
    const mic = loadWorklet("pcm-processor.js", 24000);
    const blockOf = (amp: number) => new Float32Array(128).fill(amp);

    mic.port.onmessage?.({ data: { command: "aiSpeaking", value: true } });

    // At 24 kHz (5.33 ms/block), 40 blocks (~213 ms) of 0.10 speaker echo trains the normalized floor
    for (let i = 0; i < 40; i++) {
      mic.process([[blockOf(0.1)]], [], {});
    }
    // 0.15 peak stays below adapted floor (~0.092 * 1.65 ≈ 0.152) -> stays ducked
    for (let i = 0; i < 20; i++) {
      mic.process([[blockOf(0.15)]], [], {});
    }
    const adaptedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      bargedIn: boolean;
    };
    expect(adaptedMsg.bargedIn).toBe(false);
    expect(new Int16Array(adaptedMsg.pcm).every((v) => v === 0)).toBe(true);

    // Multi-syllable user speech (0.26 RMS with brief dips) latches barge-in (~21 blocks = 110ms)
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 10; i++) {
        mic.process([[blockOf(0.26)]], [], {});
      }
      mic.process([[blockOf(0.06)]], [], {});
    }
    const bargedMsg = mic.port.postMessage.mock.calls.at(-1)?.[0] as {
      pcm: ArrayBuffer;
      bargedIn: boolean;
    };
    expect(bargedMsg.bargedIn).toBe(true);
    expect(new Int16Array(bargedMsg.pcm).some((v) => v > 1000)).toBe(true);
  });
});
