import { NextResponse } from "next/server";
import { buildArchive } from "@/lib/archive";

export const maxDuration = 60;

// Turns whatever the creator pasted into labelled archive pieces, so the rest of the app only
// ever deals with text and does not care which platform it came from.
export async function POST(request: Request) {
  try {
    const { input } = await request.json();
    if (!input?.trim()) {
      return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
    }

    const result = await buildArchive(input);

    if (result.pieces.length === 0) {
      return NextResponse.json(
        {
          error:
            result.notes.join(" ") ||
            "Could not find anything readable. Paste your post text, or Instagram reel links one per line.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
