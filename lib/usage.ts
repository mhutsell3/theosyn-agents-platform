import { db } from '@/lib/db'

// Gemini pricing (per 1M tokens) — update if pricing changes
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash':     { input: 0.10, output: 0.40 },
  'gemini-1.5-flash':     { input: 0.075, output: 0.30 },
  'gemini-1.5-pro':       { input: 1.25, output: 5.00 },
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = GEMINI_PRICING[model]
  if (!pricing) return 0
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output
}

export async function logTokenUsage({
  agent,
  model,
  provider,
  promptTokens,
  completionTokens,
}: {
  agent: string
  model: string
  provider: 'ollama' | 'gemini'
  promptTokens: number
  completionTokens: number
}) {
  try {
    await db`
      INSERT INTO token_usage (agent, model, provider, prompt_tokens, completion_tokens, total_tokens)
      VALUES (
        ${agent},
        ${model},
        ${provider},
        ${promptTokens},
        ${completionTokens},
        ${promptTokens + completionTokens}
      )`
  } catch { /* non-fatal — never let tracking break the app */ }
}
