import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// Ticking a keyword or a niche. Same shape as /api/patterns: the decision is written before the
// UI changes, so a reload shows what the creator chose rather than what the page was showing.
export async function PATCH(request: Request) {
  try {
    const { id, selected } = await request.json();

    if (!id || typeof selected !== "boolean") {
      return NextResponse.json(
        { error: "Need a choice id and selected true or false." },
        { status: 400 }
      );
    }

    const supabase = db();

    const updated = orThrow(
      await supabase.from("style_choices").update({ selected }).eq("id", id).select().single(),
      "Saving your choice"
    );

    return NextResponse.json({ choice: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Adding a keyword of your own. The model reads the archive; it does not know which words you
// think matter, and a word you type is yours by definition — so it arrives already selected.
export async function POST(request: Request) {
  try {
    const { styleReadId, label } = await request.json();
    const trimmed = typeof label === "string" ? label.trim() : "";

    if (!styleReadId) {
      return NextResponse.json({ error: "No style read to add to." }, { status: 400 });
    }
    if (!trimmed) {
      return NextResponse.json({ error: "Type a keyword first." }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return NextResponse.json(
        { error: "That is too long for a keyword. Keep it to a word or a short phrase." },
        { status: 400 }
      );
    }

    const supabase = db();

    const existing = orThrow(
      await supabase
        .from("style_choices")
        .select("id, label, ordinal, selected")
        .eq("style_read_id", styleReadId)
        .eq("kind", "keyword")
        .order("ordinal", { ascending: true }),
      "Reading the current keywords"
    );

    // Case-insensitive, because adding "Anxiety" when the model already found "anxiety" should
    // tick the one that exists rather than leave two rows saying the same thing.
    const duplicate = existing.find(
      (c) => c.label.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (duplicate) {
      const reselected = duplicate.selected
        ? duplicate
        : orThrow(
            await supabase
              .from("style_choices")
              .update({ selected: true })
              .eq("id", duplicate.id)
              .select()
              .single(),
            "Re-selecting the keyword"
          );
      return NextResponse.json({ choice: reselected, alreadyThere: true });
    }

    // The table has unique (style_read_id, kind, ordinal), so the new row goes after the last.
    const nextOrdinal = existing.reduce((max, c) => Math.max(max, c.ordinal), -1) + 1;

    const created = orThrow(
      await supabase
        .from("style_choices")
        .insert({
          style_read_id: styleReadId,
          kind: "keyword",
          ordinal: nextOrdinal,
          label: trimmed,
          // This column records where an option came from. For a keyword you supplied, that is
          // you — which is evidence of a different kind from one found in the archive.
          rationale: "added by you",
          selected: true,
        })
        .select()
        .single(),
      "Adding the keyword"
    );

    return NextResponse.json({ choice: created, alreadyThere: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
