import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// Identity without auth: a name picks out a creator row, and the id goes in the browser's
// localStorage. There is one real test user, so a password would be ceremony. The cost is that
// anyone who can open the app and type the name reaches that creator's archive — the UI says so.
export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const trimmed = typeof name === "string" ? name.trim() : "";

    if (trimmed.length < 2) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    }

    const supabase = db();

    // Case-insensitive match, so "Hariharan" and "hariharan" are the same creator rather than
    // two archives that each look half empty.
    const existing = orThrow(
      await supabase.from("creators").select("*").ilike("name", trimmed).limit(1),
      "Looking up the creator"
    );

    if (existing.length) {
      return NextResponse.json({ creator: existing[0], created: false });
    }

    const created = orThrow(
      await supabase.from("creators").insert({ name: trimmed }).select().single(),
      "Creating the creator"
    );

    return NextResponse.json({ creator: created, created: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
