import { NextResponse } from "next/server";
import { db, orThrow } from "@/lib/db";

// Shoots exist so the hypothesis has somewhere to be measured. Prepared-slot rate is the share
// of a shoot's slots that arrived with a banked idea assigned, against a 50-60% baseline, and it
// only means anything across consecutive shoots.
export async function GET(request: Request) {
  try {
    const creatorId = new URL(request.url).searchParams.get("creatorId");
    if (!creatorId) {
      return NextResponse.json({ error: "No creator selected." }, { status: 400 });
    }

    const supabase = db();

    const shoots = orThrow(
      await supabase
        .from("shoots")
        .select("*, ideas(id)")
        .eq("creator_id", creatorId)
        .order("scheduled_on", { ascending: false }),
      "Loading the shoots"
    );

    return NextResponse.json({ shoots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { creatorId, scheduledOn, slotsTotal } = await request.json();

    if (!creatorId || !scheduledOn) {
      return NextResponse.json({ error: "Need a creator and a date." }, { status: 400 });
    }

    const slots = Number(slotsTotal);
    if (!Number.isInteger(slots) || slots < 1) {
      return NextResponse.json({ error: "Slots must be a whole number above zero." }, { status: 400 });
    }

    const supabase = db();

    const saved = orThrow(
      await supabase
        .from("shoots")
        .insert({ creator_id: creatorId, scheduled_on: scheduledOn, slots_total: slots })
        .select("*, ideas(id)")
        .single(),
      "Creating the shoot"
    );

    return NextResponse.json({ shoot: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
