import { NextResponse } from "next/server";
import type { MediaKind } from "@/lib/types";
import { badRequest, companyPage, companyPayload, mobileAuth, ok } from "@/app/api/mobile/_lib/catalog";

function parseKind(value: string | null): MediaKind | null {
  if (value === "movie" || value === "show") return value;
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return badRequest("Invalid company");

  try {
    const { supabase } = await mobileAuth();
    const url = new URL(request.url);
    const kind = parseKind(url.searchParams.get("kind"));
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    if (kind) return ok({ kind, ...(await companyPage(id, kind, page, supabase)) });
    const company = await companyPayload(id, supabase);
    return ok({ company, movies: company.movies, shows: company.shows });
  } catch (error) {
    console.error("Mobile company API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Company failed" }, { status: 502 });
  }
}
