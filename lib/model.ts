import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Single switch for the whole app: if an Anthropic key is present it wins, otherwise Groq.
// Swapping providers is a key in .env.local, not a code change.
const useAnthropic = !!process.env.ANTHROPIC_API_KEY;

const GROQ_MODEL = "openai/gpt-oss-120b";
const ANTHROPIC_MODEL = "claude-opus-5-5";

export const activeProvider = useAnthropic ? "anthropic" : "groq";
export const activeModel = useAnthropic ? ANTHROPIC_MODEL : GROQ_MODEL;

// Every route calls Claude or Groq through here, so the model choice, token limits and error
// handling live in one place.
export async function askModel(prompt: string, effort: "medium" | "high" = "high") {
  if (useAnthropic) {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      output_config: { effort },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined this request.");
    }

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_completion_tokens: 16000,
    // gpt-oss exposes a reasoning dial; the archive gate is a judgment call, so it gets the
    // higher setting while outline writing does not need it.
    reasoning_effort: effort,
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0]?.message?.content ?? "";
}

// The prompts ask for bare JSON, but models wrap it in prose or a code fence often enough that
// trusting the whole response to parse would break the app in a demo.
export function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in the model response.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}
