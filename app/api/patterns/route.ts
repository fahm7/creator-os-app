import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// Rejecting a claim used to be a React Set, so it vanished on reload and the app silently went
// back to generating from a style read the creator had already corrected. Now it is a row.
export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();

    if (!id || !["pending", "confirmed", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Need a pattern id and a status of pending, confirmed or rejected." },
        { status: 400 }
      );
    }

    const supabase = db();

    // The table constrains decided_at to be null exactly when the status is pending, so the two
    // have to move together.
    const updated = orThrow(
      await supabase
        .from("style_patterns")
        .update({ status, decided_at: status === "pending" ? null : new Date().toISOString() })
        .eq("id", id)
        .select()
        .single(),
      "Saving the decision"
    );

    return NextResponse.json({ pattern: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
