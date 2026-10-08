import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Single switch for the whole app: if an Anthropic key is present it wins, otherwise Groq.
// Swapping providers is a key in .env.local, not a code change.
const useAnthropic = !!process.env.ANTHROPIC_API_KEY;

const GROQ_MODEL = "openai/gpt-oss-120b";
const ANTHROPIC_MODEL = "claude-opus-5-5";

// Groq's free tier allows 8000 tokens per minute, and the limit counts the requested completion
// as well as the prompt. Asking for 16000 therefore failed before the prompt was even read, so
// the ceiling is per call and sized to the longest output any route actually needs: eight gated
// ideas. Anthropic has no such constraint and keeps its own headroom.
const GROQ_MAX_TOKENS = 4000;
const ANTHROPIC_MAX_TOKENS = 16000;

export const activeProvider = useAnthropic ? "anthropic" : "groq";
export const activeModel = useAnthropic ? ANTHROPIC_MODEL : GROQ_MODEL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tokens per minute is a sliding window, so a run of three calls in one flow can exhaust it even
// when no single call is oversized. Waiting is the only thing that clears it.
const RETRY_WAIT_MS = 20_000;

function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? error.status : undefined;
  const message = "message" in error ? String(error.message) : "";
  // Groq reports a tokens-per-minute overflow as 413 rather than 429, so the message matters as
  // much as the status.
  return status === 429 || (status === 413 && /per minute|TPM|rate limit/i.test(message));
}

async function withRateLimitRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isRateLimited(error)) throw error;

    // One retry only: the route is capped at 60s on Vercel Hobby, and a second wait would not fit.
    await sleep(RETRY_WAIT_MS);
    try {
      return await run();
    } catch (retryError) {
      if (!isRateLimited(retryError)) throw retryError;
      throw new Error(
        "Groq's free tier ran out of tokens for this minute. Wait a minute and try again, or add ANTHROPIC_API_KEY to .env.local — the app switches to Claude automatically and that limit disappears."
      );
    }
  }
}

// Every route calls Claude or Groq through here, so the model choice, token limits and error
// handling live in one place.
export async function askModel(prompt: string, effort: "medium" | "high" = "high") {
  if (useAnthropic) {
    const client = new Anthropic();
    const response = await withRateLimitRetry(() =>
      client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        output_config: { effort },
        messages: [{ role: "user", content: prompt }],
      })
    );

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

  const completion = await withRateLimitRetry(() =>
    groq.chat.completions.create({
      model: GROQ_MODEL,
      max_completion_tokens: GROQ_MAX_TOKENS,
      // gpt-oss exposes a reasoning dial; the archive gate is a judgment call, so it gets the
      // higher setting while outline writing does not need it.
      reasoning_effort: effort,
      messages: [{ role: "user", content: prompt }],
    })
  );

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
