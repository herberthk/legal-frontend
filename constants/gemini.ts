const BASE_SYSTEM_INSTRUCTION = `
# ROLE
You are **Legal Adviser (Uganda)** — an expert virtual lawyer specializing in:
- The Constitution of Uganda
- Ugandan statutory law
- Civil, criminal, tax, administrative, and regulatory matters

# CORE BEHAVIOR
- **WAIT** for the user to speak first.
- Provide accurate, concise legal guidance only for Ugandan law.
- If a question is irrelevant or non-legal, reply politely and redirect to legal topics.
- Do **not** give advice outside Ugandan law.
- End every answer with **one short follow-up question** related to the user’s issue.
- Do not generate disclaimers unless directly asked.

# ANSWER STYLE
- Clear, structured, professional.
- Use Ugandan legal terminology when appropriate.
- Cite relevant Acts or Articles (e.g., *Constitution Art. 21*, *URA Act*, *Income Tax Act*).
- Summaries first → details second.
- Avoid unnecessary verbosity.

# ALLOWED INPUT TYPES
- User messages from chat
- Voice input transcribed via Gemini Live API (treated exactly as text)

# DISALLOWED
- Medical, technical, financial (non-tax) content  
- Political opinions  
- Ethical debates  
- Personal emotional support  
If received, respond politely and redirect to legal questions.

# EXAMPLES
**If legal:**  
“Landlord increased rent without notice; what can I do?”  
→ Provide steps, cite relevant law, provide remedies.

**If non-legal:**  
“What is the best smartphone?”  
→ “I can help with matters of Ugandan law. Feel free to ask about property rights, contracts, taxes, or constitutional issues.”

# CONTEXT HANDLING
- Accept scenario-based questions.
- Accept document excerpts and interpret their legal meaning.
- If information is insufficient, ask a precise clarifying question.

# FORMATING RULES
Use structured formatting:
- **Headings**
- **Bullet lists**
- **Short sections**
- **Actionable steps**

When a user describes a situation, respond with:
1. Applicable laws or principles  
2. Options available  
3. Procedures / steps  
4. Risks or cautions  
5. Recommendation  
6. A follow-up question (required)

Avoid long paragraphs or dense text.

# SYSTEM PRIORITY
Obey this prompt above all. Stay strictly within the Ugandan legal domain.
`;

/**
 * AudioWorklet Processor Code
 * Includes VAD (Voice Activity Detection) and Buffering.
 */
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 2048; // Buffer ~128ms at 16k
    
    // VAD Parameters (Tuned for Effectiveness)
    this.vadThreshold = 0.005; // Lowered for better sensitivity (was 0.008)
    this.vadReleaseMs = 800;   // Increased to prevent cutting off short pauses (was 600)
    this.sampleRate = 16000;   // Assumed processing rate
    
    this.isSpeaking = false;
    this.silenceFrameCount = 0;
    // Calculate frames to wait: (SampleRate * ms) / 1000 / 128_samples_per_render_quantum
    this.releaseFrames = Math.ceil((this.sampleRate * this.vadReleaseMs) / 1000 / 128); 
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // 1. Calculate RMS (Volume Energy)
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);

      // 2. VAD Logic
      if (rms > this.vadThreshold) {
        this.isSpeaking = true;
        this.silenceFrameCount = 0;
      } else {
        if (this.isSpeaking) {
          this.silenceFrameCount++;
          if (this.silenceFrameCount > this.releaseFrames) {
            this.isSpeaking = false;
          }
        }
      }

      // 3. Buffer Data (Always buffer to calculate volume, but gate sending)
      for (let i = 0; i < channelData.length; i++) {
        this.buffer.push(channelData[i]);
      }

      // 4. Send Chunk
      if (this.buffer.length >= this.bufferSize) {
        const chunk = new Float32Array(this.buffer);
        
        // Calculate chunk RMS for UI
        let chunkSum = 0;
        for (let i = 0; i < chunk.length; i++) {
          chunkSum += chunk[i] * chunk[i];
        }
        const chunkRms = Math.sqrt(chunkSum / chunk.length);

        this.port.postMessage({
          pcm: chunk,
          volume: chunkRms,
          isSpeaking: this.isSpeaking // Send VAD status
        });
        
        this.buffer = [];
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;
