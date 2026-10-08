import { NextResponse } from "next/server";
import { askModel, extractJson, activeModel, activeProvider } from "@/lib/model";
import { outlinePrompt } from "@/lib/prompts";
import { db, orThrow } from "@/lib/db";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

type Outline = {
  hook: string;
  points: { point: string; bullets: string[] }[];
  close: string;
  experienceSlot: string;
  styleBasis: string[];
  needsVerification: string[];
};

// Step 3: expand an approved idea into an outline locked to the confirmed patterns. Outline
// rather than finished script, because that is what creators who ship at volume actually prep.
// The idea text is read from the row rather than taken from the request, so the outline cannot
// end up describing an idea that is not the one on record.
export async function POST(request: Request) {
  try {
    const { ideaId, patterns, format } = await request.json();

    if (!ideaId || !patterns?.length) {
      return NextResponse.json(
        { error: "Need an idea and the confirmed style patterns." },
        { status: 400 }
      );
    }

    const supabase = db();

    const idea = orThrow(
      await supabase.from("ideas").select("id, idea").eq("id", ideaId).single(),
      "Loading the idea"
    );

    const chosenFormat = format ?? "short-form video script, 30-60 seconds";
    const text = await askModel(outlinePrompt(idea.idea, patterns, chosenFormat), "medium");
    const parsed = extractJson<Outline>(text);

    const saved = orThrow(
      await supabase
        .from("outlines")
        .insert({
          idea_id: idea.id,
          format: chosenFormat,
          hook: parsed.hook ?? null,
          points: (parsed.points ?? []) as unknown as Json,
          close: parsed.close ?? null,
          experience_slot: parsed.experienceSlot ?? null,
          style_basis: parsed.styleBasis ?? [],
          needs_verification: parsed.needsVerification ?? [],
          provider: activeProvider,
          model: activeModel,
        })
        .select()
        .single(),
      "Storing the outline"
    );

    return NextResponse.json({
      outlineId: saved.id,
      hook: saved.hook,
      points: parsed.points ?? [],
      close: saved.close,
      experienceSlot: saved.experience_slot,
      styleBasis: saved.style_basis,
      needsVerification: saved.needs_verification,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
