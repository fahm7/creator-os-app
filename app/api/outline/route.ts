import { NextResponse } from "next/server";
import { askClaude, extractJson } from "@/lib/claude";
import { outlinePrompt } from "@/lib/prompts";

export const maxDuration = 120;

type Outline = {
  hook: string;
  points: { point: string; bullets: string[] }[];
  close: string;
  experienceSlot: string;
  styleBasis: string[];
  needsVerification: string[];
};

// Step 3: expand an approved idea into an outline locked to the confirmed patterns. Outline rather
// than finished script, because that is what creators who ship at volume actually prep.
export async function POST(request: Request) {
  try {
    const { idea, patterns, format } = await request.json();
    if (!idea || !patterns?.length) {
      return NextResponse.json(
        { error: "Need an idea and the confirmed style patterns." },
        { status: 400 }
      );
    }

    const text = await askClaude(
      outlinePrompt(idea, patterns, format ?? "short-form video script, 30-60 seconds"),
      "medium"
    );
    return NextResponse.json(extractJson<Outline>(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
