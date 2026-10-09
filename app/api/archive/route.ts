import { NextResponse } from "next/server";
import { buildArchive } from "@/lib/archive";
import { db, orThrow } from "@/lib/db";

export const maxDuration = 60;

// Turns whatever the creator pasted into labelled archive pieces, stores them, and returns the
// whole archive rather than just this run's additions — the point of storing it is that it
// accumulates across sessions instead of being retyped every time.
export async function POST(request: Request) {
  try {
    const { creatorId, input } = await request.json();

    if (!creatorId) {
      return NextResponse.json({ error: "No creator selected." }, { status: 400 });
    }
    if (!input?.trim()) {
      return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
    }

    const supabase = db();

    const stored = orThrow(
      await supabase
        .from("archive_pieces")
        .select("*")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: true }),
      "Reading the stored archive"
    );

    // Anything already transcribed is not fetched again. Supadata's free tier is 100 requests,
    // so re-reading an archive used to cost the same as building it the first time.
    const knownUrls = new Set(stored.map((p) => p.url).filter((u): u is string => !!u));
    const knownPasted = new Set(stored.filter((p) => !p.url).map((p) => p.content.trim()));

    const result = await buildArchive(input, knownUrls);

    const fresh = result.pieces.filter((p) =>
      p.url ? !knownUrls.has(p.url) : !knownPasted.has(p.text.trim())
    );

    if (fresh.length) {
      orThrow(
        await supabase
          .from("archive_pieces")
          .insert(
            fresh.map((p) => ({
              creator_id: creatorId,
              source: p.source,
              url: p.url ?? null,
              content: p.text,
              transcribed: p.source !== "pasted" && p.source !== "linkedin",
            }))
          )
          .select("id"),
        "Storing the archive"
      );
    }

    const all = orThrow(
      await supabase
        .from("archive_pieces")
        .select("*")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: true }),
      "Re-reading the archive"
    );

    // Three is enough to read a style from provisionally; fewer is not. Counted against the
    // stored archive rather than this paste, so adding a third piece to two already saved works.
    const MIN_PIECES = 3;

    if (all.length < MIN_PIECES) {
      return NextResponse.json(
        {
          error:
            all.length === 0
              ? result.notes.join(" ") ||
                "Could not find anything readable. Paste your post text, or reel and video links one per line."
              : `Your archive holds ${all.length} piece(s). Add at least ${MIN_PIECES} — more is better.` +
                (result.notes.length ? ` ${result.notes.join(" ")}` : ""),
        },
        { status: 400 }
      );
    }

    const notes = [...result.notes];
    if (fresh.length) notes.unshift(`Added ${fresh.length} new piece(s). Archive now holds ${all.length}.`);
    if (result.spent) notes.push(`${result.spent} Supadata request(s) used this run.`);

    return NextResponse.json({
      pieces: all.map((p) => ({ source: p.source, url: p.url ?? undefined, text: p.content })),
      notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
