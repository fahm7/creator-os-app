import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// Everything the app needs to come back to where the creator left off, in one round trip. This
// is what makes the idea bank a bank rather than a page of state: it survives the reload.
// Not cached — cacheComponents is on, and a GET that queries Postgres defers to request time,
// which is what creator-scoped data must do.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = db();

    const creators = orThrow(
      await supabase.from("creators").select("*").eq("id", id).limit(1),
      "Loading the creator"
    );

    if (!creators.length) {
      return NextResponse.json({ error: "No such creator." }, { status: 404 });
    }

    const pieces = orThrow(
      await supabase
        .from("archive_pieces")
        .select("*")
        .eq("creator_id", id)
        .order("created_at", { ascending: true }),
      "Loading the archive"
    );

    // Only the most recent style read matters: an earlier one described an archive that has
    // since grown, and its confirmed patterns were confirmed against that smaller archive.
    const styleReads = orThrow(
      await supabase
        .from("style_reads")
        .select("*")
        .eq("creator_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      "Loading the style read"
    );

    const styleRead = styleReads[0] ?? null;

    const patterns = styleRead
      ? orThrow(
          await supabase
            .from("style_patterns")
            .select("*")
            .eq("style_read_id", styleRead.id)
            .order("ordinal", { ascending: true }),
          "Loading the style patterns"
        )
      : [];

    // The keyword and niche ticks, so a reload shows what the creator chose rather than
    // resetting to the model's defaults.
    const choices = styleRead
      ? orThrow(
          await supabase
            .from("style_choices")
            .select("*")
            .eq("style_read_id", styleRead.id)
            .order("kind", { ascending: true })
            .order("ordinal", { ascending: true }),
          "Loading the keyword and niche choices"
        )
      : [];

    const ideas = orThrow(
      await supabase
        .from("ideas")
        .select("*")
        .eq("creator_id", id)
        .order("created_at", { ascending: false }),
      "Loading the idea bank"
    );

    const reactions = orThrow(
      await supabase
        .from("reactions")
        .select("*, ideas(idea, verdict)")
        .eq("creator_id", id)
        .order("created_at", { ascending: false }),
      "Loading the run log"
    );


    return NextResponse.json({
      creator: creators[0],
      pieces,
      styleRead,
      patterns,
      choices,
      ideas,
      reactions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
