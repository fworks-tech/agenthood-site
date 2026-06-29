export interface OllamaStreamParams {
  baseUrl: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export async function streamOllamaClientSide(
  params: OllamaStreamParams,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${params.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  return response;
}
