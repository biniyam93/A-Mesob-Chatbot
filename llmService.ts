
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, MessageRole } from "./types";

/**
 * 'Scout' engine models.
 * gemini-3-flash-preview is the most reliable multimodal model available 
 * for both high-accuracy transcription and RAG-based reasoning.
 */
const SCOUT_MODEL_ID = 'gemini-3-flash-preview';

export class LLMService {
  /**
   * Post-processes the model output to ensure a clean, professional appearance.
   */
  private postProcessResponse(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/\*\*/g, '') // Remove double asterisks (bold)
      .replace(/\*/g, '')   // Remove single asterisks (italics/bullets)
      .replace(/^[-+]\s+/gm, '• ') // Standardize dash-bullets to round bullets
      .replace(/\n{3,}/g, '\n\n') // Normalize multi-line breaks
      .trim();
  }

  /**
   * Transcribes audio data into text with extreme verbatim precision.
   */
  async transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: SCOUT_MODEL_ID,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `TRANSCRIPTION PROTOCOL: VERBATIM ONLY.
Listen to the audio and provide a WORD-FOR-WORD transcription.

RULES:
1. DO NOT summarize, paraphrase, or 'improve' the speech.
2. DO NOT correct grammar or linguistic errors.
3. If it's Amharic, use Ethiopic script (Fidel).
4. If it's English, use Latin script.
5. OUTPUT ONLY THE TRANSCRIBED TEXT.`
            }
          ]
        },
        config: {
          temperature: 0.0,
        }
      });

      return response.text?.trim() || "";
    } catch (error: any) {
      console.error("Transcription error detail:", error);
      throw new Error("Neural audio decoding failed. Ensure the recording is clear.");
    }
  }

  async generateResponse(
    question: string,
    context: string,
    history: ChatMessage[],
    signal?: AbortSignal
  ) {
    const fallback = "A-Mesob Assistances: I'm sorry, I don't know based on the provided documents.";
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const trimmedContext = context.length > 800000 
      ? context.substring(0, 800000) + "...[Content truncated]" 
      : context;

    const systemInstruction = `
You are the A-Mesob Scout Engine, a document intelligence specialist. 
Answer using ONLY the provided "Document Context".

LOGICAL RULES:
1. SEARCH: Thoroughly scan the Context.
2. NOT FOUND: If missing, respond ONLY with: "${fallback}"
3. FORMATTING: Use bullet points (•). NO bolding (**) or italics (*).
`;

    try {
      const contents = [
        ...history.map(msg => ({
          role: msg.role === MessageRole.USER ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: question }] }
      ];

      // Note: The GenAI SDK currently uses standard fetch internally in many environments
      // We pass the signal if supported or handle it in the App layer by discarding the result.
      const response = await ai.models.generateContent({
        model: SCOUT_MODEL_ID,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.0, 
        },
      });

      if (signal?.aborted) throw new Error("AbortError");

      let rawText = response.text || fallback;
      if (rawText.length > fallback.length && rawText.includes(fallback)) {
        rawText = rawText.replace(fallback, "").trim();
      }

      return {
        text: this.postProcessResponse(rawText),
        model: "Scout Engine (Gemini 3 Flash)"
      };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'AbortError') {
        throw new Error("Generation interrupted by analyst.");
      }
      console.error("Neural Engine Connectivity Error:", error);
      throw new Error("Scout Engine Error.");
    }
  }
}

export const llmService = new LLMService();
