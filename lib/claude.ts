import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Single place every route calls Claude through, so the model, effort and error handling stay
// consistent and only need changing once.
export async function askClaude(prompt: string, effort: "medium" | "high" = "high") {
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort },
    messages: [{ role: "user", content: prompt }],
  });

  // Opus 5.5 always thinks, so the response carries thinking blocks alongside the answer; only the
  // text blocks are ours to read.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }

  return text;
}

// The prompts ask for bare JSON, but models sometimes wrap it in prose or a code fence, so pull
// the outermost object rather than trusting the whole response to parse.
export function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in the model response.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}
