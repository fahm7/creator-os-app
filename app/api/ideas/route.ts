import { NextResponse } from "next/server";
import { askClaude, extractJson } from "@/lib/claude";
import { ideasPrompt } from "@/lib/prompts";

export const maxDuration = 120;

type Idea = {
  idea: string;
  mechanism: "kipling" | "reframe" | "vertical";
  verdict: "new" | "reframe" | "repeat";
  gateNote: string;
  why: string;
  needsVerification: boolean;
  verifyWhat: string;
};

// Step 2: generate candidates from the creator's own themes and gate each against the archive.
// This is the one part no existing tool does, so the verdict travels with every idea.
export async function POST(request: Request) {
  try {
    const { archive, patterns, themes, topic } = await request.json();
    if (!archive || !patterns?.length) {
      return NextResponse.json(
        { error: "Need the archive and at least one confirmed style pattern." },
        { status: 400 }
      );
    }

    const text = await askClaude(
      ideasPrompt(archive, patterns, themes ?? [], topic),
      "high"
    );
    return NextResponse.json(extractJson<{ ideas: Idea[] }>(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
