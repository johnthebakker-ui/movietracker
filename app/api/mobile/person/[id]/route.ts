import { NextResponse } from "next/server";
import { badRequest, mobileAuth, ok, personCredits } from "@/app/api/mobile/_lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return badRequest("Invalid person");

  try {
    const { supabase } = await mobileAuth();
    const person = await personCredits(id, supabase);
    return ok({ person, items: person.credits });
  } catch (error) {
    console.error("Mobile person API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Person failed" }, { status: 502 });
  }
}
