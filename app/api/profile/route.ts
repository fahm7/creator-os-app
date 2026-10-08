import { NextResponse } from "next/server";
import { askModel, extractJson, activeModel, activeProvider } from "@/lib/model";
import { profilePrompt } from "@/lib/prompts";
import { db, orThrow } from "@/lib/db";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

type Profile = {
  niche: string;
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
    if (!archive || archive.trim().length < 200) {
      return NextResponse.json(
        { error: "Paste more of the archive. A few hundred characters is not enough to read a style from." },
        { status: 400 }
      );
    }

    const text = await askModel(profilePrompt(archive), "high");
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

    return NextResponse.json({
      styleReadId: styleRead.id,
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
