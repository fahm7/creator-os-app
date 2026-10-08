import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// The run log, and the reason this app has a database at all. It is simultaneously the evidence
// the hypothesis is measured on and the record of what the creator actually accepted, so holding
// it in localStorage meant one cleared browser erased the result.
export async function POST(request: Request) {
  try {
    const { creatorId, ideaId, outlineId, reaction, note } = await request.json();

    if (!creatorId || !ideaId) {
      return NextResponse.json({ error: "Need a creator and an idea." }, { status: 400 });
    }
    if (!["accept", "fix", "reject"].includes(reaction)) {
      return NextResponse.json(
        { error: "Reaction must be accept, fix or reject." },
        { status: 400 }
      );
    }

    const supabase = db();

    const saved = orThrow(
      await supabase
        .from("reactions")
        .insert({
          creator_id: creatorId,
          idea_id: ideaId,
          outline_id: outlineId ?? null,
          reaction,
          // "What needed fixing?" A draft rejected and fixed in two minutes is a different
          // result from one rejected and abandoned, so the note is part of the measurement.
          note: note?.trim() || null,
        })
        .select("*, ideas(idea, verdict)")
        .single(),
      "Recording the reaction"
    );

    return NextResponse.json({ reaction: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
