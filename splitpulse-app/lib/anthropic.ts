import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton — initialized on first use so build doesn't require the key.
let _client: Anthropic | null = null;

export const anthropic = (): Anthropic => {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
};

// Fastest + cheapest in the Claude 4.x family — used for find-object,
// summary, chat. Sonnet/Opus are overkill for these short interactions.
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";

// Kept for callers that might want a smarter model in the future.
export const MODEL_SONNET = "claude-sonnet-4-5";

export const extractText = (msg: Anthropic.Messages.Message): string => {
  const first = msg.content[0];
  if (first?.type === "text") return first.text;
  return "";
};
