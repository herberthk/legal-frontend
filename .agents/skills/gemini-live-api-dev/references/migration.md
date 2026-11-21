# Gemini Live API Migration & Upgrading Reference

Step-by-step checklists and protocol deltas for migrating legacy Live API models (Gemini 2.0, 2.5, and 3.1 Live) to **Gemini 3.8 Live** (`gemini-3.8-live`) and **Gemini 3.8 Live Extended Thinking** (`gemini-3.8-live-extended-thinking`).

For full hosted documentation, fetch:

- [Gemini 3.8 Live Model Card & Migration Guide](https://aistudio.google.com/docs/models/gemini-3.8-live.md) (`#migrating`)
- [Gemini 3.8 Live Extended Thinking Model Card & Upgrading Guide](https://aistudio.google.com/docs/models/gemini-3.8-live-extended-thinking.md) (`#upgrading`)
- [Thinking in the Live API Guide](https://aistudio.google.com/docs/live-api/thinking.md)

---

## 1. Migrating to Gemini 3.8 Live (`gemini-3.8-live`)

Use `gemini-3.8-live` as the default option for low-latency conversational voice agents without reasoning delays.

### Model Replacements

| Legacy Model                                                  | Replacement                                                | Notes                                                                |
| :------------------------------------------------------------ | :--------------------------------------------------------- | :------------------------------------------------------------------- |
| `gemini-3.1-flash-live-preview`                               | `gemini-3.8-live` (or `gemini-3.8-live-extended-thinking`) | Upgrades to default async tool calling & full-session client content |
| `gemini-2.5-flash-native-audio-preview-12-2025`               | `gemini-3.8-live`                                          | Upgrades to 3.8 native audio dialogue                                |
| `gemini-live-2.5-flash-preview` / `gemini-2.0-flash-live-001` | `gemini-3.8-live`                                          | Deprecated preview models                                            |

### Migration Checklist (`gemini-3.1-flash-live-preview` → `gemini-3.8-live`)

- [ ] **Model string**: Update your model string from `gemini-3.1-flash-live-preview` to `gemini-3.8-live`.
- [ ] **Thinking level**: `thinking_level` is not supported for `gemini-3.8-live`.
      Omit `thinking_level` (or `thinking_config`) from your session setup.
- [ ] **Asynchronous function calling**: Async execution (`behavior: NON_BLOCKING`) is now the default function calling mode. You can still use synchronous blocking mode for backwards compatibility by setting `behavior: BLOCKING` on your tool declarations. Function scheduling (`SILENT`, `WHEN_IDLE`, `INTERRUPTED`) is supported.
- [ ] **Client content updates**: `send_client_content` is supported throughout the entire session lifecycle with explicit roles (`user` or `model`). Setting `turn_complete=true` unconditionally interrupts active model generation. If you send content without `turn_complete`, the server waits for subsequent messages before responding.
- [ ] **Proactive audio**: Proactive audio is permanently enabled. Remove `proactive_audio: false` (setting it returns an error).
- [ ] **Affective dialogue**: Affective dialogue is removed from the API. Remove any `enable_affective_dialog` configurations from your code.
- [ ] **Turn coverage**: Defaults to `TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO`. Video frames are sent to the model by default, so only send frames when needed to manage context and cost.
- [ ] **Response modalities**: Audio is the supported response modality (`response_modalities=["AUDIO"]`). Enable output audio transcription (`output_audio_transcription`) if your application requires a text transcript.

---

## 2. Upgrading to Gemini 3.8 Live Extended Thinking (`gemini-3.8-live-extended-thinking`)

`gemini-3.8-live-extended-thinking` introduces background reasoning during live audio sessions. It plans and executes asynchronous tools in the background while speaking natural conversational fillers (e.g., _"Checking flight options now..."_) to keep the interaction active.

### Upgrading Checklist & Protocol Deltas

When integrating `gemini-3.8-live-extended-thinking`, update your client state management to handle asynchronous reasoning signals:

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d1842dda338b02bca2e012936ab3409ca125f65e08e1986f3fd10af74d423fd1 -->

- [ ] **Model string**: Set `model="gemini-3.8-live-extended-thinking"`.
- [ ] **Asynchronous reasoning protocol**: When interacting with models that use asynchronous reasoning, `turnComplete: true` no longer indicates that the model is idle. The server may continue processing background reasoning or tool calls. Your client must continue listening for subsequent server messages (such as tool calls or audio frames) after `turnComplete: true` arrives.
- [ ] **Monitoring `interaction_status`**: Use the `interaction_status` (Python) / `interactionStatus` (JS) field on `message.server_content` (Python) / `message.serverContent` (JS) to determine current server state:
  - `IN_PROGRESS`: The server is actively processing user input, running background reasoning, or awaiting responses for asynchronous tool calls. Additional model output or tool calls may follow.
  - `IDLE`: The server has finished all processing, reasoning, and tool calls. The session is idle and waiting for user input.
- [ ] **Asynchronous function calling**: Only asynchronous non-blocking execution (`behavior: NON_BLOCKING`) is supported. Synchronous blocking mode is not supported and returns a hard error. Function scheduling configurations are not supported.
- [ ] **Thinking configuration**: Configure background reasoning using `thinking_config` (`thinking_level`: `"low"` | `"medium"` | `"high"`) in your setup configuration. Note that MINIMAL is not supported.
- [ ] **Client content updates**: `send_client_content` is supported throughout the entire session lifecycle with explicit roles (`user` or `model`). Setting `turn_complete=true` immediately interrupts active generation.
- [ ] **Proactive audio**: Permanently enabled. Setting `proactive_audio: false` returns an error.

<!-- /coderabbit-ai-generated:v1 -->

---

## 3. SDK Implementation Examples (`gemini-3.8-live-extended-thinking`)

### Python

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7205a42dbd395a95f168908fe0d663c226e1049ba220c385821d05acbb0d0914 -->

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-3.8-live-extended-thinking"

search_flights = types.FunctionDeclaration(
    name="search_flights",
    description="Searches for available flights to a destination.",
    behavior="NON_BLOCKING",
    parameters={
        "type": "OBJECT",
        "properties": {"destination": {"type": "STRING"}},
        "required": ["destination"],
    },
)

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    thinking_config=types.ThinkingConfig(thinking_level="low"),
    tools=[types.Tool(function_declarations=[search_flights])],
)

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        # Requires google-genai >= 2.23.0. Repeat receive() if an iterator
        # ends before IDLE, for example on turn_complete without a status.
        await session.send_realtime_input(text="Find me a flight to Seattle.")
        while True:
            async for message in session.receive():
                content = message.server_content
                status = content.interaction_status if content else None

                # 1. Play spoken conversational fillers or final audio response
                if content and content.model_turn:
                    for part in content.model_turn.parts:
                        if part.inline_data:
                            # Process 24kHz PCM audio chunk
                            pass

                # 2. Execute asynchronous non-blocking tool call
                if message.tool_call:
                    for call in message.tool_call.function_calls:
                        response = types.FunctionResponse(
                            id=call.id,
                            name=call.name,
                            response={"result": "Flight DL 145 ($145)"},
                        )
                        await session.send_tool_response(function_responses=[response])

                # 3. Session is idle only when status == "IDLE"
                if status == "IDLE":
                    print("Interaction finished.")
                    return

if __name__ == "__main__":
    asyncio.run(main())
```

<!-- /coderabbit-ai-generated:v1 -->

### JavaScript / TypeScript

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e381a5a8a8174d070adf2e1e7834b11ba2113805e71475ba387b41f65ecb2d8d -->

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});
const model = "gemini-3.8-live-extended-thinking";

const searchFlights = {
  name: "search_flights",
  description: "Searches for available flights to a destination.",
  behavior: "NON_BLOCKING",
  parameters: {
    type: "OBJECT",
    properties: { destination: { type: "STRING" } },
    required: ["destination"],
  },
};

const session = await ai.live.connect({
  model,
  config: {
    responseModalities: ["audio"],
    thinkingConfig: { thinkingLevel: "low" },
    tools: [{ functionDeclarations: [searchFlights] }],
  },
  callbacks: {
    onmessage: async (message) => {
      // 1. Play spoken conversational fillers or final audio response
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData) {
            // Process base64 24kHz PCM audio chunk
          }
        }
      }

      // 2. Execute asynchronous non-blocking tool call
      if (message.toolCall?.functionCalls) {
        for (const call of message.toolCall.functionCalls) {
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: { result: "Flight DL 145 ($145)" },
              },
            ],
          });
        }
      }

      // 3. Session is idle only when interactionStatus === 'IDLE'
      if (message.serverContent?.interactionStatus === "IDLE") {
        console.log("Session is idle and waiting for input.");
      }
    },
  },
});
```

<!-- /coderabbit-ai-generated:v1 -->
