import { NextResponse } from "next/server";
import { askModel, extractJson } from "@/lib/model";
import { profilePrompt } from "@/lib/prompts";

export const maxDuration = 120;

type Profile = {
  patterns: { claim: string; evidence: string }[];
  themes: string[];
  archiveSize: number;
  thin: boolean;
};

// Step 1 of the flow: read the pasted archive and return style claims the creator will confirm or
// reject, since an unverified style read poisons everything generated after it.
export async function POST(request: Request) {
  try {
    const { archive } = await request.json();
    if (!archive || archive.trim().length < 200) {
      return NextResponse.json(
        { error: "Paste more of the archive. A few hundred characters is not enough to read a style from." },
        { status: 400 }
      );
    }

    const text = await askModel(profilePrompt(archive), "high");
    return NextResponse.json(extractJson<Profile>(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
