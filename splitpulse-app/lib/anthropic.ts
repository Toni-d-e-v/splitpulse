import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton — initialized on first use so build doesn't require the key.
let _client: Anthropic | null = null;

export const anthropic = (): Anthropic => {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
};

// Per master plan: latest stable Sonnet at time of writing.
export const MODEL_SONNET = "claude-sonnet-4-5";

export const extractText = (
  msg: Anthropic.Messages.Message,
): string => {
  const first = msg.content[0];
  if (first?.type === "text") return first.text;
  return "";
};
