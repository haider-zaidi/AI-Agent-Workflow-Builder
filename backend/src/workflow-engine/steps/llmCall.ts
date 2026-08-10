import { env } from "../../env.js";

export interface LlmCallConfig {
  prompt: string;
  system?: string;
}

/**
 * Calls a real LLM API (Groq by default - OpenAI-compatible chat completions).
 * If no API key is configured, falls back to a clearly-disclosed stub with an
 * artificial delay, per spec section 2, so the rest of the app is still
 * demonstrable without a key.
 */
export async function executeLlmCall(config: LlmCallConfig): Promise<unknown> {
  if (!config.prompt) {
    throw new Error("llm_call step requires a non-empty 'prompt' in config");
  }

  if (!env.llmApiKey) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      stub: true,
      note: "LLM_API_KEY not configured - returning a stubbed response.",
      prompt: config.prompt,
      text: "negative",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.httpRequestTimeoutMs);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.llmApiKey}`,
      },
      body: JSON.stringify({
        model: env.llmModel,
        messages: [
          ...(config.system ? [{ role: "system", content: config.system }] : []),
          { role: "user", content: config.prompt },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM API request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}
