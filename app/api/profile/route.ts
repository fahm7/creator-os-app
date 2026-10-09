import { NextResponse } from "next/server";
import { askModel, extractJson, activeModel, activeProvider } from "@/lib/model";
import { profilePrompt } from "@/lib/prompts";
import { db, orThrow } from "@/lib/db";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

type Profile = {
  niche: string;
  nicheOptions: { label: string; rationale: string }[];
  patterns: { claim: string; evidence: string }[];
  themes: string[];
  keywords: string[];
  archiveSize: number;
  thin: boolean;
};

// Step 1 of the flow: read the pasted archive and return style claims the creator will confirm or
// reject, since an unverified style read poisons everything generated after it. The claims are
// stored with their decision state, so a reload no longer quietly restores rejected ones.
export async function POST(request: Request) {
  try {
    const { creatorId, archive } = await request.json();

    if (!creatorId) {
      return NextResponse.json({ error: "No creator selected." }, { status: 400 });
    }
    // Count the piece markers the client assembles rather than characters: three one-line
    // pieces are a legitimate start, and one long piece is not three.
    const pieceCount = (archive?.match(/^--- piece \d+ /gm) ?? []).length;

    if (!archive?.trim()) {
      return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
    }
    if (pieceCount > 0 && pieceCount < 3) {
      return NextResponse.json(
        { error: `Only ${pieceCount} piece(s) to read from. Add at least 3 — more is better.` },
        { status: 400 }
      );
    }

    // Medium, not high. Reading a style is extraction — the claims are there in the archive or
    // they are not — while the archive gate in /api/ideas is the judgment call that earns the
    // higher setting. High effort here spent roughly three times the reasoning tokens and, now
    // that the prompt also asks for 5-7 niche options, left too little room under Groq's cap:
    // the answer came back truncated about one run in three.
    const text = await askModel(profilePrompt(archive), "medium");
    const parsed = extractJson<Profile>(text);

    const supabase = db();

    // provider and model travel with the read: a style claim is only interpretable against the
    // model that made it, and voice drift between models is a thing worth being able to see.
    const styleRead = orThrow(
      await supabase
        .from("style_reads")
        .insert({
          creator_id: creatorId,
          niche: parsed.niche ?? null,
          themes: parsed.themes ?? [],
          keywords: parsed.keywords ?? [],
          archive_size: parsed.archiveSize ?? null,
          thin: parsed.thin ?? false,
          provider: activeProvider,
          model: activeModel,
          raw: parsed as unknown as Json,
        })
        .select()
        .single(),
      "Storing the style read"
    );

    const rows = (parsed.patterns ?? []).map((p, i) => ({
      style_read_id: styleRead.id,
      ordinal: i,
      claim: p.claim,
      evidence: p.evidence ?? null,
    }));

    const patterns = rows.length
      ? orThrow(
          await supabase.from("style_patterns").insert(rows).select().order("ordinal", { ascending: true }),
          "Storing the style patterns"
        )
      : [];

    // Keywords arrive ticked and niches unticked: the creator prunes the first and decides the
    // second, and either can be left alone — nothing downstream is gated on a selection.
    const choiceRows = [
      ...(parsed.keywords ?? []).map((label, i) => ({
        style_read_id: styleRead.id,
        kind: "keyword" as const,
        ordinal: i,
        label,
        rationale: null,
        selected: true,
      })),
      ...(parsed.nicheOptions ?? []).map((o, i) => ({
        style_read_id: styleRead.id,
        kind: "niche" as const,
        ordinal: i,
        label: o.label,
        rationale: o.rationale ?? null,
        selected: false,
      })),
    ].filter((r) => r.label?.trim());

    const choices = choiceRows.length
      ? orThrow(
          await supabase
            .from("style_choices")
            .insert(choiceRows)
            .select()
            .order("kind", { ascending: true })
            .order("ordinal", { ascending: true }),
          "Storing the keyword and niche options"
        )
      : [];

    return NextResponse.json({
      styleReadId: styleRead.id,
      choices,
      niche: styleRead.niche,
      themes: styleRead.themes,
      keywords: styleRead.keywords,
      archiveSize: styleRead.archive_size,
      thin: styleRead.thin,
      patterns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
