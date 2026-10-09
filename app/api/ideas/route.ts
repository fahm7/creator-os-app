import { NextResponse } from "next/server";
import { askModel, extractJson, activeModel, activeProvider } from "@/lib/model";
import { ideasPrompt } from "@/lib/prompts";
import { db, orThrow } from "@/lib/db";

export const maxDuration = 60;

type Idea = {
  idea: string;
  mechanism: "kipling" | "reframe" | "vertical";
  verdict: "new" | "reframe" | "repeat";
  gateNote: string;
  why: string;
  needsVerification: boolean;
  verifyWhat: string;
};

const MECHANISMS = ["kipling", "reframe", "vertical"] as const;
const VERDICTS = ["new", "reframe", "repeat"] as const;

// Step 2: generate candidates from the creator's own themes and gate each against the archive.
// This is the one part no existing tool does, so the verdict travels with every idea — and now
// into the bank, which is the whole premise: ideas accumulate through the week.
export async function POST(request: Request) {
  try {
    const { creatorId, styleReadId, archive, patterns, themes, niche, keywords, topic } =
      await request.json();

    if (!creatorId) {
      return NextResponse.json({ error: "No creator selected." }, { status: 400 });
    }
    if (!archive || !patterns?.length) {
      return NextResponse.json(
        { error: "Need the archive and at least one confirmed style pattern." },
        { status: 400 }
      );
    }

    // niche and keywords arrive already resolved by the client: the creator's ticks if they made
    // any, otherwise what the model read. An empty selection is not an error.
    const text = await askModel(
      ideasPrompt({
        archive,
        patterns,
        themes: themes ?? [],
        niche: niche?.trim() || "not specified — infer it from the themes and the archive",
        keywords: keywords ?? [],
        topic,
      }),
      "high"
    );
    const parsed = extractJson<{ ideas: Idea[] }>(text);

    if (!parsed.ideas?.length) {
      return NextResponse.json({ error: "The model returned no ideas." }, { status: 502 });
    }

    const supabase = db();

    // A verdict outside the enum would be rejected by Postgres and lose the whole batch, so an
    // unrecognised one is treated as "new" rather than thrown away. The gate note still carries
    // whatever the model actually said.
    const rows = parsed.ideas.map((i) => ({
      creator_id: creatorId,
      style_read_id: styleReadId ?? null,
      idea: i.idea,
      mechanism: MECHANISMS.includes(i.mechanism) ? i.mechanism : null,
      verdict: VERDICTS.includes(i.verdict) ? i.verdict : ("new" as const),
      gate_note: i.gateNote ?? null,
      why: i.why ?? null,
      needs_verification: !!i.needsVerification,
      verify_what: i.verifyWhat ?? null,
      requested_topic: topic?.trim() || null,
      provider: activeProvider,
      model: activeModel,
    }));

    const saved = orThrow(
      await supabase.from("ideas").insert(rows).select().order("created_at", { ascending: true }),
      "Storing the ideas"
    );

    return NextResponse.json({ ideas: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
