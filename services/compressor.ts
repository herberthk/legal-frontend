import { GoogleGenAI } from "@google/genai";

/**
 * Context Compression Service
 * Handles long-running sessions by summarizing old context.
 */
export class ContextCompressor {
  private history: { role: string; text: string }[] = [];
  private summarizedContext: string = "";
  private apiKey: string;
  // Compress after ~20 turns or sufficient length
  private readonly COMPRESSION_THRESHOLD = 20;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  addTurn(role: "user" | "model", text: string) {
    this.history.push({ role, text });
  }

  /**
   * Generates a compressed summary of the conversation history.
   * Keeps the last few turns intact for immediate continuity.
   */
  async getOptimizedContext(): Promise<string> {
    if (this.history.length < 4) {
      // Not enough history to compress, just return formatted string
      return this.formatHistory(this.history);
    }

    // Keep last 4 turns fresh, compress the rest
    const turnsToCompress = this.history.slice(0, this.history.length - 4);
    const recentTurns = this.history.slice(this.history.length - 4);

    if (turnsToCompress.length === 0) return this.formatHistory(recentTurns);

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      // Use a cheaper, fast model for summarization

      const textToCompress = this.formatHistory(turnsToCompress);
      const prompt = `
          Summarize the following legal consultation transcript into a concise context paragraph. 
          Retain key facts, specific laws cited, user constraints, and the current stage of advice.
          
          Transcript:
          ${textToCompress}
          
          Existing Summary: ${this.summarizedContext}
        `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite-preview-09-2025",
        contents: prompt,
      });
      const newSummary = result.text || "";

      // Update internal state
      this.summarizedContext = newSummary;

      // Return Combined Context: Old Summary + Recent Turns
      return `
        [PREVIOUS CONVERSATION SUMMARY]
        ${this.summarizedContext}
        
        [RECENT DISCUSSION]
        ${this.formatHistory(recentTurns)}
        `;
    } catch (e) {
      console.warn(
        "Context compression failed, falling back to raw history",
        e,
      );
      return this.formatHistory(this.history);
    }
  }

  private formatHistory(turns: { role: string; text: string }[]): string {
    return turns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
  }

  clear() {
    this.history = [];
    this.summarizedContext = "";
  }
}
