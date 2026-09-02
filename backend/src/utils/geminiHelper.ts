import { GoogleGenAI } from '@google/genai';

// In-memory model cooldown tracker to avoid repeatedly waiting on quota-exhausted models
const modelCooldowns: Record<string, number> = {};
const COOLDOWN_DURATION_MS = 60000; // 1 minute cooldown on 429 / quota limit

/**
 * Helper to call Gemini generateContent with automatic model fallback and fast failover.
 * Handles 429 / RESOURCE_EXHAUSTED / Quota exceeded / Timeout errors by failing over to gemini-3.1-flash-lite.
 */
export async function generateContentWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  },
  timeoutMs: number = 8000
) {
  const allModels = ['gemini-3.6-flash', 'gemini-3.1-flash-lite'];
  const now = Date.now();

  // Filter out models currently in cooldown unless all models are in cooldown
  let availableModels = allModels.filter(m => !modelCooldowns[m] || modelCooldowns[m] < now);
  if (availableModels.length === 0) {
    availableModels = allModels; // Fallback to attempting all models if all are cooled down
  }

  let lastErr: any = null;

  for (const model of availableModels) {
    try {
      const callPromise = ai.models.generateContent({
        ...params,
        model
      });

      // Timeout wrapper for individual model call
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      });

      const response = await (Promise.race([callPromise, timeoutPromise]) as Promise<any>);
      // On success, clear any cooldown for this model
      delete modelCooldowns[model];
      return response;
    } catch (err: any) {
      lastErr = err;
      const errMsg = String(err?.message || err);
      
      // Failover if quota limit / rate limit / 429 or timeout
      if (
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('timed out')
      ) {
        // Set 1-minute cooldown for this model
        modelCooldowns[model] = Date.now() + COOLDOWN_DURATION_MS;
        console.log(`[Gemini Failover] ${model} quota/timeout reached. Switch to fallback model.`);
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}
