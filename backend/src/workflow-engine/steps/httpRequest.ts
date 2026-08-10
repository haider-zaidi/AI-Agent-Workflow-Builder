import { env } from "../../env.js";

export interface HttpRequestConfig {
  method?: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function executeHttpRequest(config: HttpRequestConfig): Promise<unknown> {
  if (!config.url) {
    throw new Error("http_request step requires a 'url' in config");
  }
  const method = config.method ?? "GET";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.httpRequestTimeoutMs);

  try {
    const response = await fetch(config.url, {
      method,
      headers: {
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(config.headers ?? {}),
      },
      body: method === "POST" && config.body !== undefined ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`HTTP request failed (${response.status})`);
    }

    return { status: response.status, body: responseBody };
  } finally {
    clearTimeout(timeout);
  }
}
