import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";

// Recording whether the creator would actually shoot a banked idea. A measurement rather than a
// preference: "fewer than half the banked ideas ever get marked yes" is a falsification
// condition, which is why the column is nullable — unanswered is not the same as no.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { wouldShoot, status } = await request.json();

    const patch: TablesUpdate<"ideas"> = {};

    if (wouldShoot !== undefined) patch.would_shoot = wouldShoot;
    if (status !== undefined) {
      if (!["banked", "shortlisted", "shot", "discarded"].includes(status)) {
        return NextResponse.json({ error: "Unknown idea status." }, { status: 400 });
      }
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }

    const supabase = db();

    const updated = orThrow(
      await supabase.from("ideas").update(patch).eq("id", id).select().single(),
      "Updating the idea"
    );

    return NextResponse.json({ idea: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
