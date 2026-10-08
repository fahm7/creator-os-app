import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";

// Assigning a banked idea to a shoot slot, and recording whether the creator would actually
// shoot it. Both are measurements rather than preferences: slot assignment produces the
// prepared-slot rate, and would_shoot is the second falsification condition.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { shootId, wouldShoot, status } = await request.json();

    const patch: TablesUpdate<"ideas"> = {};

    // shootId is allowed to be explicitly null, which unassigns, so presence is checked rather
    // than truthiness.
    if (shootId !== undefined) patch.shoot_id = shootId;
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
